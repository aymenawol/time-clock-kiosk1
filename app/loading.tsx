// Default route-loading skeleton (replaces the previous no-op that returned null).
export default function Loading() {
  return (
    <div className="p-6 space-y-4 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-56 bg-muted rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-card border border-border rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-card border border-border rounded-xl" />
    </div>
  )
}
