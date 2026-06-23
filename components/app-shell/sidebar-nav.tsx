'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NavGroup } from '@/lib/navigation'

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true
  if (href !== '/' && pathname.startsWith(href + '/')) return true
  // '/admin' (no trailing section) lands on Employees
  if (href === '/admin/employees' && pathname === '/admin') return true
  return false
}

export function SidebarNav({
  groups,
  onNavigate,
  className,
}: {
  groups: NavGroup[]
  onNavigate?: () => void
  className?: string
}) {
  const pathname = usePathname()

  return (
    <nav className={cn('flex flex-col gap-5 px-3 py-4', className)} aria-label="Primary">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {group.label}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  item.alert && !active && 'hover:text-danger'
                )}
              >
                <Icon
                  className={cn(
                    'size-[18px] shrink-0 transition-colors',
                    active ? 'text-primary' : item.alert ? 'text-danger/80' : 'text-muted-foreground group-hover:text-foreground'
                  )}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {item.external && <ExternalLink className="size-3.5 shrink-0 text-muted-foreground/60" />}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
