// Static copies of stored photos, made by each Cloudflare build
// (scripts/build/stored-photos.mjs → src/data/generated/photo-manifest.json).
// A photo with a static copy is shown from /photos/… (no Worker, no Storage read
// per visitor); one without keeps its /_image address. Without the manifest
// (development, type checks, tests, Vercel builds) nothing changes.
export type StaticPhoto = { path: string; width: number; height: number; variants: Record<number, string> };

type Entry = { path: string; original: string; variants: Record<string, string> };

function manifest(): Record<string, Entry> {
  // Vite replaces this call at build time; outside Vite it doesn't exist.
  try {
    const files = import.meta.glob("./generated/photo-manifest.json", { eager: true, import: "default" }) as Record<string, Record<string, Entry>>;
    return Object.values(files)[0] ?? {};
  } catch {
    return {};
  }
}

const MANIFEST = manifest();

/** The static copy of a stored photo at its largest width, the smaller widths as variants; null when there is none. */
export function staticPhoto(url: string, width: number | null | undefined, height: number | null | undefined, entries: Record<string, Entry> = MANIFEST): StaticPhoto | null {
  const entry = entries[url];
  if (!entry) return null;
  const widths = Object.keys(entry.variants).map(Number).sort((a, b) => a - b);
  const largest = widths.at(-1);
  if (!largest) return null;
  const w = width ?? largest;
  const h = height ?? largest;
  return {
    path: entry.variants[largest],
    width: largest,
    height: Math.round((h * largest) / w),
    variants: Object.fromEntries(widths.slice(0, -1).map((size) => [size, entry.variants[size]])),
  };
}
