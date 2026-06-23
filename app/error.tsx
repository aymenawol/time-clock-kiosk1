'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Route-level error boundary. Catches render/fetch errors in any segment that
// doesn't define its own error.tsx, and offers a retry instead of a white screen.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface to the console / monitoring; replace with a logger when available.
    console.error('Route error:', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center bg-card border border-border rounded-2xl p-8 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-danger-surface border border-danger-border text-danger flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-foreground text-lg font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground text-sm mt-2">
          This screen failed to load. Try again, or contact your administrator if it keeps happening.
        </p>
        {error?.digest && (
          <p className="text-muted-foreground text-xs mt-3 font-mono">Ref: {error.digest}</p>
        )}
        <Button onClick={reset} className="mt-5">
          Try again
        </Button>
      </div>
    </div>
  )
}
