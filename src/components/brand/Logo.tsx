// Brief 5.1.8. The Corvane wordmark is plain text in the brand primary
// colour (white on dark backgrounds) and the DM Sans of the rest of the app,
// followed by "Customer Hub". No image file is involved.
//
// `compact` always renders the wordmark alone. Left at its default (false),
// the "Customer Hub" segment shows only at the full 1280px+ width and
// collapses at 1024px on its own (brief 5.2, "At 1024px").
export function Logo({ tone = "forest", compact = false }: { tone?: "forest" | "white"; compact?: boolean }) {
  const colour = tone === "forest" ? "text-primary" : "text-white";
  return (
    <span className={`inline-flex items-center gap-2 ${colour}`} aria-label="Corvane Customer Hub">
      <span className="font-sans text-[22px] font-bold leading-none tracking-tight" aria-hidden="true">Corvane</span>
      {!compact && (
        <span className="hidden items-center gap-2 lg:inline-flex" aria-hidden="true">
          <span className="h-5 w-px bg-current opacity-30" />
          <span className="font-sans font-semibold text-[16px]">Customer Hub</span>
        </span>
      )}
    </span>
  );
}
