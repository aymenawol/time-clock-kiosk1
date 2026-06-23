import { Skeleton } from '@/components/ui/skeleton'

// Route-level skeleton shaped like the employee directory (toolbar + table) so
// the shell + a matching placeholder paint instantly while data streams in.
export default function Loading() {
  return (
    <div className="p-6 space-y-4" aria-busy="true" aria-label="Loading employees">
      <Skeleton className="h-8 w-48" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Skeleton className="h-10 w-full sm:w-64" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border p-3">
          <Skeleton className="h-5 w-full" />
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border p-3 last:border-0">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
