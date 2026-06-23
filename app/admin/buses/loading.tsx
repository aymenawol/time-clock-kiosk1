import { Skeleton } from '@/components/ui/skeleton'

// Route-level skeleton shaped like the fleet grid.
export default function Loading() {
  return (
    <div className="p-6 space-y-4" aria-busy="true" aria-label="Loading fleet">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
