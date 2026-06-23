'use client'

import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { LogOut, User as UserIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROLE_LABEL } from '@/lib/navigation'

function initials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U'
  }
  return (email?.[0] ?? 'U').toUpperCase()
}

export function UserMenu({
  name,
  email,
  role,
  align = 'end',
}: {
  name: string | null
  email: string | null
  role: string | null
  align?: 'start' | 'end'
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [])

  async function signOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const roleLabel = role ? ROLE_LABEL[role] ?? role : null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full p-0.5 pr-1 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initials(name, email)}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-popover shadow-xl',
            align === 'end' ? 'right-0' : 'left-0'
          )}
        >
          <div className="border-b border-border p-3">
            <p className="truncate text-sm font-semibold text-foreground">{name ?? 'Signed in'}</p>
            {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
            {roleLabel && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                <UserIcon className="size-3" />
                {roleLabel}
              </span>
            )}
          </div>
          <div className="p-1.5">
            <button
              type="button"
              onClick={signOut}
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-accent"
            >
              <LogOut className="size-4 text-muted-foreground" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
