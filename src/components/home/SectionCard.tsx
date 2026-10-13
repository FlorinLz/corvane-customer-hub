/** Brief 5.3 "Card header: section title (h2), item count pill, one-line rule hint". A 0-item section collapses to one line (M11 States "Empty"). */
export function SectionCard({ id, title, count, hint, children }: { id: string; title: string; count: number; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-label={title} className="flex flex-col gap-2 rounded-md border border-border p-4">
      <div className="flex items-center gap-2">
        <h2 className="text-subsection">{title}</h2>
        <span className="rounded-pill bg-tint px-2 text-meta text-text-secondary">{count}</span>
        {hint && <span className="text-meta text-text-secondary">{hint}</span>}
      </div>
      {count === 0 ? <p className="text-meta text-text-secondary">Nothing to do here</p> : children}
    </section>
  );
}

export function SectionSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4">
      <div className="h-6 w-40 animate-pulse rounded-sm bg-tint" />
      <div className="h-10 animate-pulse rounded-sm bg-tint" />
    </div>
  );
}

