import { Skeleton } from '@/components/ui/skeleton'

// Route-level skeleton shaped like the dispatch board (stat row + tile grid).
export default function Loading() {
  return (
    <div className="p-4 space-y-4" aria-busy="true" aria-label="Loading dispatch board">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 18 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
