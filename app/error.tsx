'use client'

import { useEffect } from 'react'

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
      <div className="max-w-md w-full text-center bg-card border border-border rounded-2xl p-8">
        <div className="w-12 h-12 rounded-full bg-red-900/40 text-red-400 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">!</div>
        <h2 className="text-foreground text-lg font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground text-sm mt-2">
          This screen failed to load. Try again, or contact your administrator if it keeps happening.
        </p>
        {error?.digest && (
          <p className="text-gray-600 text-xs mt-3 font-mono">Ref: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-foreground text-sm font-medium"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
