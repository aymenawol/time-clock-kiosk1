import { Skeleton } from '@/components/ui/skeleton'

// Route-level skeleton shaped like the reports view (tab row + table).
export default function Loading() {
  return (
    <div className="p-6 space-y-4" aria-busy="true" aria-label="Loading reports">
      <Skeleton className="h-8 w-40" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-md" />
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border p-3 last:border-0">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
