interface Props {
  id: string;
  label: string;
}

/** Renders the 7 sections not yet built this milestone — visible in the flow (so the sidebar's full shape is honest) without pretending to be functional. */
export default function PlaceholderSection({ id, label }: Props) {
  return (
    <section id={`section-${id}`} className="fp-card scroll-mt-6 border-dashed p-6 opacity-70">
      <h2 className="fp-serif text-lg tracking-[0.08em] text-[#171717]">{label}</h2>
      <p className="mt-2 text-[13px] text-[#9B948F]">Coming in the next milestone.</p>
    </section>
  );
}
