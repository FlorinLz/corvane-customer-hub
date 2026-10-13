/**
 * Brief 6.13.9 issue-flow States: "loading (skeletons, action buttons
 * disabled until the issue loads)". The Issue page (page.tsx) is one
 * Server Component that awaits every panel's data before rendering, so
 * this file (Next's loading.tsx convention) is what actually shows
 * while that await is in flight -- no action button exists yet to
 * click, which satisfies "disabled until loaded" without needing a
 * second, partially-hydrated render of the real page.
 */
function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-sm bg-tint ${className}`} />;
}

export default function IssuePageLoading() {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-6 py-6">
      <div className="flex flex-col gap-3 border-b border-border pb-4">
        <Block className="h-7 w-64" />
        <Block className="h-4 w-80" />
        <Block className="h-4 w-full max-w-[600px]" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Block className="h-40 rounded-md" />
          <Block className="h-48 rounded-md" />
        </div>
        <div className="flex flex-col gap-4">
          <Block className="h-40 rounded-md" />
          <Block className="h-32 rounded-md" />
        </div>
      </div>
    </div>
  );
}
