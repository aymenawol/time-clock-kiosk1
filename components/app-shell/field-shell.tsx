'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Menu, LogOut } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import NotificationBell from '@/components/notification-bell'
import { ThemeToggle } from '@/components/theme-toggle'
import { SidebarNav } from './sidebar-nav'
import { DRIVER_NAV, FUELER_NAV, ROLE_LABEL, type NavGroup } from '@/lib/navigation'

function navForVariant(variant: 'driver' | 'fueler'): { groups: NavGroup[]; homeHref: string; label: string } {
  if (variant === 'fueler') {
    return { groups: FUELER_NAV, homeHref: '/fueler', label: ROLE_LABEL.fueler_washer }
  }
  return { groups: DRIVER_NAV, homeHref: '/driver', label: ROLE_LABEL.driver }
}

export function FieldShell({
  variant,
  name,
  children,
}: {
  /** Which field app this is — drives navigation & home link. */
  variant: 'driver' | 'fueler'
  name: string | null
  children: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { groups, homeHref, label } = navForVariant(variant)

  async function signOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-card/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/70 sm:px-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Menu className="size-6" />
        </button>

        <Link href={homeHref} className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            RC
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-foreground">Rolecall</span>
            <span className="text-[11px] text-muted-foreground">{label}</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-0.5">
          <NotificationBell />
          <ThemeToggle />
        </div>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex w-72 flex-col p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              RC
            </span>
            <span className="ml-2.5 text-sm font-bold text-foreground">Rolecall</span>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <SidebarNav groups={groups} onNavigate={() => setOpen(false)} />
          </div>
          <div className="border-t border-border p-3">
            {name && (
              <p className="px-2 pb-2 text-sm font-semibold text-foreground">
                {name}
                <span className="block text-xs font-normal text-muted-foreground">{label}</span>
              </p>
            )}
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <LogOut className="size-4 text-muted-foreground" />
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <main className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">{children}</main>
    </div>
  )
}
