'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, Search } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import NotificationBell from '@/components/notification-bell'
import { ThemeToggle } from '@/components/theme-toggle'
import { SidebarNav } from './sidebar-nav'
import { CommandMenu } from './command-menu'
import { UserMenu } from './user-menu'
import { getOfficeNav, ROLE_LABEL } from '@/lib/navigation'

function Brand({ homeHref, roleLabel }: { homeHref: string; roleLabel: string }) {
  return (
    <Link href={homeHref} className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        RC
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-bold text-foreground">Rolecall</span>
        <span className="text-[11px] text-muted-foreground">{roleLabel}</span>
      </span>
    </Link>
  )
}

export function OfficeShell({
  navKey,
  role,
  name,
  email,
  children,
}: {
  /** Which area's navigation to show (admin, dispatcher, coordinator, …). */
  navKey: string
  /** The viewer's actual role — drives the user menu badge. */
  role: string
  name: string | null
  email: string | null
  children: React.ReactNode
}) {
  const groups = getOfficeNav(navKey)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [isMac, setIsMac] = useState(true)

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform))
  }, [])

  const homeHref = groups[0]?.items[0]?.href ?? '/'
  const roleLabel = ROLE_LABEL[navKey] ?? 'Console'

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
          <Brand homeHref={homeHref} roleLabel={roleLabel} />
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <SidebarNav groups={groups} />
        </div>
      </aside>

      {/* Mobile / tablet drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="flex w-72 flex-col p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
            <Brand homeHref={homeHref} roleLabel={roleLabel} />
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <SidebarNav groups={groups} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-card/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/70">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>

          <div className="lg:hidden">
            <Brand homeHref={homeHref} roleLabel={roleLabel} />
          </div>

          {/* Desktop search trigger */}
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="hidden h-9 w-72 items-center gap-2 rounded-lg border border-border bg-background/60 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent lg:flex"
          >
            <Search className="size-4" />
            <span>Search…</span>
            <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {isMac ? '⌘K' : 'Ctrl K'}
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
              aria-label="Search"
            >
              <Search className="size-5" />
            </button>
            <NotificationBell />
            <ThemeToggle />
            <div className="ml-1">
              <UserMenu name={name} email={email} role={role} />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      <CommandMenu groups={groups} open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  )
}
