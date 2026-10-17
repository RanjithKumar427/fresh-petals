// Upload safety for the admin media library. Nothing reaches storage until
// the bytes have been proved to be the image they claim to be:
//
//   1. The file's own signature must be JPEG, PNG, WebP or GIF, and must
//      match the declared MIME type (a renamed HTML/SVG file, or a PNG
//      labelled image/jpeg, is refused).
//   2. Size limits before decoding: at most MAX_INPUT_BYTES, at most
//      MAX_FRAMES frames and MAX_PIXELS decoded pixels in total (width ×
//      frame height × frames), read from the header, so a small file that
//      expands to gigabytes ("decompression bomb") is refused unread.
//   3. The whole image is decoded (a corrupt or truncated file fails) and
//      re-encoded in its own format. The output contains pixels only: EXIF
//      and other metadata (GPS, camera, comments) and anything appended
//      after the image data are gone. JPEG orientation is applied first so
//      photographs keep their visible rotation. Animation is kept for GIF
//      and WebP.
//   4. The stored name is derived, not trusted: a slug of the original
//      name plus the extension of the detected format.
//
// The admin is the only uploader (approved administrator, aal2); this is
// defence in depth against a mislabelled or hostile file, not a malware
// scanner.
import sharp, { type Metadata, type OutputInfo } from "sharp";

export type ImageFormat = "jpeg" | "png" | "webp" | "gif";

export const IMAGE_MIME: Record<ImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};
const EXTENSION: Record<ImageFormat, string> = { jpeg: ".jpg", png: ".png", webp: ".webp", gif: ".gif" };

/**
 * Vercel accepts request bodies up to 4.5 MB, so a larger file never
 * reaches the function; 4 MiB leaves room for the multipart envelope.
 * The storage bucket's own limit (8 MiB) bounds the re-encoded output.
 */
export const MAX_INPUT_BYTES = 4 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
export const MAX_PIXELS = 40_000_000;
export const MAX_FRAMES = 100;

/** The format named by the file's first bytes, or null. */
export function sniffImageFormat(bytes: Uint8Array): ImageFormat | null {
  const at = (offset: number, ...values: number[]) => values.every((value, i) => bytes[offset + i] === value);
  if (bytes.length >= 3 && at(0, 0xff, 0xd8, 0xff)) return "jpeg";
  if (bytes.length >= 8 && at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (bytes.length >= 6 && (at(0, 0x47, 0x49, 0x46, 0x38, 0x37, 0x61) || at(0, 0x47, 0x49, 0x46, 0x38, 0x39, 0x61))) return "gif";
  if (bytes.length >= 12 && at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "webp";
  return null;
}

/** "My Photo (1).JPG" → "my-photo-1.jpg" for a JPEG; the extension always follows the content. */
export function safeImageFilename(original: string, format: ImageFormat): string {
  const base = original
    .replace(/\.[^.]*$/, "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  return `${base || "image"}${EXTENSION[format]}`;
}

export type SafeImage = { buffer: Buffer; format: ImageFormat; mimeType: string; filename: string; width: number; height: number; frames: number };
export type ImageCheck = { ok: true; image: SafeImage } | { ok: false; error: string };

const refuse = (error: string): ImageCheck => ({ ok: false, error });

export async function sanitizeImage(input: { buffer: Buffer; declaredMime: string; filename: string }): Promise<ImageCheck> {
  const { buffer } = input;
  if (buffer.byteLength === 0) return refuse("That file is empty.");
  if (buffer.byteLength > MAX_INPUT_BYTES) return refuse("Images must be 4 MB or smaller.");

  const format = sniffImageFormat(buffer);
  if (!format) return refuse("Only JPEG, PNG, WebP or GIF images are supported.");
  const declared = input.declaredMime.toLowerCase().trim();
  if (declared !== IMAGE_MIME[format]) return refuse("The file's contents don't match its type. Save it again as a JPEG, PNG, WebP or GIF and retry.");

  const options = { animated: format === "gif" || format === "webp", failOn: "error" as const, limitInputPixels: MAX_PIXELS };
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer, options).metadata();
  } catch {
    return refuse("This image couldn't be read. It may be damaged; save it again and retry.");
  }
  if (metadata.format !== format) return refuse("The file's contents don't match its type. Save it again as a JPEG, PNG, WebP or GIF and retry.");
  const frames = metadata.pages ?? 1;
  const width = metadata.width ?? 0;
  const frameHeight = metadata.pageHeight ?? (metadata.height ?? 0) / frames;
  if (!width || !frameHeight) return refuse("This image couldn't be read. It may be damaged; save it again and retry.");
  if (frames > MAX_FRAMES) return refuse(`Animated images can have at most ${MAX_FRAMES} frames.`);
  if (width * frameHeight * frames > MAX_PIXELS) return refuse("This image is too large in pixels. Resize it (for example to 3000 pixels on the long side) and retry.");

  let output: { data: Buffer; info: OutputInfo };
  try {
    let pipeline = sharp(buffer, options);
    if (format === "jpeg") pipeline = pipeline.rotate().jpeg({ quality: 90, mozjpeg: true });
    else if (format === "png") pipeline = pipeline.png({ compressionLevel: 9 });
    else if (format === "webp") pipeline = pipeline.webp({ quality: 90 });
    else pipeline = pipeline.gif();
    output = await pipeline.toBuffer({ resolveWithObject: true });
  } catch {
    return refuse("This image couldn't be read. It may be damaged; save it again and retry.");
  }
  if (output.data.byteLength > MAX_OUTPUT_BYTES) return refuse("This image is too large after processing. Resize it and retry.");

  return {
    ok: true,
    image: {
      buffer: output.data,
      format,
      mimeType: IMAGE_MIME[format],
      filename: safeImageFilename(input.filename, format),
      width: output.info.width,
      height: output.info.pageHeight ?? output.info.height,
      frames,
    },
  };
}
