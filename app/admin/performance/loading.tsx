import { Skeleton } from '@/components/ui/skeleton'

// Route-level skeleton shaped like the driver performance table.
export default function Loading() {
  return (
    <div className="p-6 space-y-4" aria-busy="true" aria-label="Loading performance">
      <Skeleton className="h-8 w-52" />
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border p-3">
          <Skeleton className="h-5 w-full" />
        </div>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border p-3 last:border-0">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="ml-auto h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
