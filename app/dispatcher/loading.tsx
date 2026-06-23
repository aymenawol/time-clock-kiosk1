import { Skeleton } from '@/components/ui/skeleton'

// Route-level skeleton shaped like the dispatcher shift list.
export default function Loading() {
  return (
    <div className="p-4 space-y-3" aria-busy="true" aria-label="Loading dispatcher">
      <Skeleton className="h-8 w-56" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      ))}
    </div>
  )
}
