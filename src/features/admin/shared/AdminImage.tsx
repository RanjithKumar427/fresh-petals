import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";

/**
 * An image in the admin that says so when its file is gone, instead of a
 * broken-image icon. Some media records point at files deliberately removed
 * from the site (for example two add-on photos taken down for privacy and
 * trademark reasons); the record stays until the owner replaces or removes
 * it. Server-rendered images can fail before React attaches onError, so the
 * state is also checked once after mounting.
 */
export default function AdminImage({ src, alt = "", className = "", ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const ref = useRef<HTMLImageElement>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setMissing(false);
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0 && src) setMissing(true);
  }, [src]);

  if (missing || !src) {
    return (
      <span
        role="img"
        aria-label={`Image missing${alt ? `: ${alt}` : ""}`}
        title="This image's file is missing. Replace it, or remove it from this product."
        data-image-missing
        className={`${className} inline-flex items-center justify-center bg-[#F3F0EE] text-center text-[9px] font-semibold uppercase leading-tight tracking-[0.08em] text-[#9A6B1F]`}
      >
        Image missing
      </span>
    );
  }

  return <img ref={ref} src={src} alt={alt} className={className} onError={() => setMissing(true)} {...rest} />;
}
