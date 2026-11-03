// sanitizeImage() for Cloudflare Workers, where sharp cannot run. Same
// contract as the sharp path in ./imageSafety.ts (format proved by
// signature and decoder, size limits before decoding, pixels-only re-encode
// in the original format, derived name), using the Images binding:
//
//   - frame count and canvas size of GIF/WebP animations are read here from
//     the file's own structure (the binding's info() reports no frame count),
//     so MAX_FRAMES and MAX_PIXELS are enforced before anything is decoded;
//   - info() decodes the header and must report the sniffed format;
//   - the image is re-encoded by the binding in its own format. Cloudflare
//     keeps no metadata in PNG, WebP or GIF output; for JPEG `metadata: none`
//     discards EXIF (including GPS).
//
// Verified locally only against wrangler's offline Images simulator, which
// supports format conversion but not every option; see docs/cloudflare-migration.md.
import { cloudflareEnv } from "../platform/requestScope";
import type { ImageCheck, ImageFormat } from "./imageSafety";

type ImagesInfo = { format?: string; width?: number; height?: number; fileSize?: number };
type ImagesBinding = {
  info(stream: ReadableStream<Uint8Array>): Promise<ImagesInfo>;
  input(stream: ReadableStream<Uint8Array>): {
    transform(options: Record<string, unknown>): ReturnType<ImagesBinding["input"]>;
    output(options: { format: string; quality?: number; anim?: boolean }): Promise<{ response(): Response; contentType(): string }>;
  };
};

const streamOf = (bytes: Uint8Array) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });

const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u24le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
const u32le = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** Frames and canvas size of a GIF, read by walking its blocks; null when malformed. */
export function gifFrames(b: Uint8Array): { frames: number; width: number; height: number } | null {
  if (b.length < 13) return null;
  const width = u16le(b, 6);
  const height = u16le(b, 8);
  let i = 13;
  if (b[10] & 0x80) i += 3 * (1 << ((b[10] & 0x07) + 1));
  const skipSubBlocks = () => {
    while (i < b.length) {
      const size = b[i++];
      if (size === 0) return true;
      i += size;
    }
    return false;
  };
  let frames = 0;
  while (i < b.length) {
    const marker = b[i++];
    if (marker === 0x3b) return frames ? { frames, width, height } : null;
    if (marker === 0x21) {
      i += 1; // extension label
      if (!skipSubBlocks()) return null;
    } else if (marker === 0x2c) {
      if (i + 9 > b.length) return null;
      const packed = b[i + 8];
      i += 9;
      if (packed & 0x80) i += 3 * (1 << ((packed & 0x07) + 1));
      i += 1; // LZW minimum code size
      if (!skipSubBlocks()) return null;
      frames += 1;
    } else {
      return null;
    }
  }
  // Truncated before the trailer: decoders still show the frames read so far.
  return frames ? { frames, width, height } : null;
}

/** Frames and canvas size of a WebP (VP8X canvas, ANMF frames); null when malformed. */
export function webpFrames(b: Uint8Array): { frames: number; width: number | null; height: number | null } | null {
  if (b.length < 12) return null;
  let i = 12;
  let frames = 0;
  let width: number | null = null;
  let height: number | null = null;
  let still = false;
  while (i + 8 <= b.length) {
    const tag = String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
    const size = u32le(b, i + 4);
    const data = i + 8;
    if (data + size > b.length) return null;
    if (tag === "VP8X" && size >= 10) {
      width = u24le(b, data + 4) + 1;
      height = u24le(b, data + 7) + 1;
    } else if (tag === "ANMF") frames += 1;
    else if (tag === "VP8 " || tag === "VP8L") still = true;
    i = data + size + (size & 1);
  }
  if (!frames && !still) return null;
  return { frames: frames || 1, width, height };
}

const MIME: Record<ImageFormat, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

export async function sanitizeWithImagesBinding(
  input: { buffer: Uint8Array; format: ImageFormat; filename: string },
  limits: { maxPixels: number; maxFrames: number; maxOutputBytes: number },
  helpers: { sniff: (bytes: Uint8Array) => ImageFormat | null; filename: (original: string, format: ImageFormat) => string },
): Promise<ImageCheck> {
  const { buffer, format } = input;
  const unreadable: ImageCheck = { ok: false, error: "This image couldn't be read. It may be damaged; save it again and retry." };
  const mismatch: ImageCheck = { ok: false, error: "The file's contents don't match its type. Save it again as a JPEG, PNG, WebP or GIF and retry." };
  const tooLarge: ImageCheck = { ok: false, error: "This image is too large in pixels. Resize it (for example to 3000 pixels on the long side) and retry." };

  let frames = 1;
  let canvas: { width: number | null; height: number | null } = { width: null, height: null };
  if (format === "gif" || format === "webp") {
    const parsed = format === "gif" ? gifFrames(buffer) : webpFrames(buffer);
    if (!parsed) return unreadable;
    frames = parsed.frames;
    canvas = { width: parsed.width, height: parsed.height };
    if (frames > limits.maxFrames) return { ok: false, error: `Animated images can have at most ${limits.maxFrames} frames.` };
    if (canvas.width && canvas.height && canvas.width * canvas.height * frames > limits.maxPixels) return tooLarge;
  }

  const env = await cloudflareEnv();
  const images = env.IMAGES as ImagesBinding | undefined;
  if (!images) return { ok: false, error: "Image uploads are not available on this deployment (no Images binding)." };

  let info: ImagesInfo;
  try {
    info = await images.info(streamOf(buffer));
  } catch {
    return unreadable;
  }
  if (info.format !== MIME[format]) return mismatch;
  const width = info.width ?? 0;
  const height = info.height ?? 0;
  if (!width || !height) return unreadable;
  if (width * height * frames > limits.maxPixels) return tooLarge;

  let output: Uint8Array;
  try {
    const result = await images
      .input(streamOf(buffer))
      .transform(format === "jpeg" ? { metadata: "none" } : {})
      .output({ format: MIME[format], quality: 90, anim: true });
    output = new Uint8Array(await result.response().arrayBuffer());
  } catch {
    return unreadable;
  }
  if (helpers.sniff(output) !== format) return unreadable;
  if (output.byteLength > limits.maxOutputBytes) return { ok: false, error: "This image is too large after processing. Resize it and retry." };

  let outInfo: ImagesInfo = {};
  try {
    outInfo = await images.info(streamOf(output));
  } catch {
    return unreadable;
  }
  return {
    ok: true,
    image: {
      buffer: Buffer.from(output),
      format,
      mimeType: MIME[format],
      filename: helpers.filename(input.filename, format),
      width: outInfo.width ?? width,
      height: outInfo.height ?? height,
      frames,
    },
  };
}
