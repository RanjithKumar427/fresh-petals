// Bounded request bodies. A Content-Length header is only a claim (and is
// absent for chunked uploads), so every handler that reads a body reads it
// through these helpers: the stream is consumed chunk by chunk and abandoned
// as soon as it passes the limit, before anything is parsed.
//
// Limits (src/server/http/requestGuard.ts applies the same numbers to the
// declared length before a handler runs):
//   public JSON (enquiry log, delivery check)   32 KiB
//   admin JSON (product editor, media, status)  256 KiB
//   sign-in, MFA and password forms              8 KiB
//   image upload (multipart)                     4.5 MB, Vercel's own request ceiling

export const BODY_LIMITS = {
  publicJson: 32 * 1024,
  adminJson: 256 * 1024,
  authForm: 8 * 1024,
  upload: 4_500_000,
} as const;

export class BodyError extends Error {
  constructor(public readonly status: 400 | 413 | 415, message: string) {
    super(message);
    this.name = "BodyError";
  }
}

/** Reads at most `limit` bytes of the body; throws BodyError(413) past it. */
export async function readBodyBytes(request: Request, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > limit) throw new BodyError(413, "Request body is too large.");
  if (!request.body) return new Uint8Array(new ArrayBuffer(0));

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => {});
      throw new BodyError(413, "Request body is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

const mediaType = (request: Request) => (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();

/** JSON body (content type application/json required), bounded. */
export async function readJson(request: Request, limit: number): Promise<unknown> {
  if (mediaType(request) !== "application/json") throw new BodyError(415, "Send the request as JSON.");
  const bytes = await readBodyBytes(request, limit);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new BodyError(400, "Invalid request body.");
  }
}

/** Form body (urlencoded or multipart), bounded. */
export async function readForm(request: Request, limit: number): Promise<FormData> {
  const type = mediaType(request);
  if (type !== "application/x-www-form-urlencoded" && type !== "multipart/form-data") throw new BodyError(415, "Unsupported form encoding.");
  const bytes = await readBodyBytes(request, limit);
  try {
    return await new Response(bytes, { headers: { "content-type": request.headers.get("content-type")! } }).formData();
  } catch {
    throw new BodyError(400, "Invalid form data.");
  }
}

/**
 * For route handlers: the parsed JSON object, or the error response to
 * return. `const parsed = await jsonBody(request, BODY_LIMITS.adminJson);
 * if (parsed instanceof Response) return parsed;`
 */
export async function jsonBody(request: Request, limit: number): Promise<Record<string, any> | Response> {
  try {
    const body = await readJson(request, limit);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new BodyError(400, "Invalid request body.");
    return body as Record<string, any>;
  } catch (error) {
    return bodyErrorResponse(error);
  }
}

/** JSON error response for a BodyError (or a generic 400 for anything else). */
export function bodyErrorResponse(error: unknown): Response {
  const status = error instanceof BodyError ? error.status : 400;
  const message = error instanceof BodyError ? error.message : "Invalid request body.";
  return new Response(JSON.stringify({ ok: false, error: message }), { status, headers: { "content-type": "application/json" } });
}
