'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Returns a function that coalesces bursts of realtime events into at most one
 * router.refresh() per `delayMs`. Replaces calling router.refresh() directly on
 * every postgres_changes event, which at scale produces a refetch storm (every
 * connected dashboard re-runs its full server query on each break/shift change).
 */
export function useDebouncedRefresh(delayMs = 1000) {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => router.refresh(), delayMs)
  }, [router, delayMs])
}
