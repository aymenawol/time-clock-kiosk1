'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/admin/employees',       label: 'Employees' },
  { href: '/admin/buses',           label: 'Fleet' },
  { href: '/admin/fleet-readiness', label: 'Fleet Status' },
  { href: '/admin/bids',            label: 'Shift Bids' },
  { href: '/admin/overtime',        label: 'Overtime' },
  { href: '/admin/forms',           label: 'Forms' },
  { href: '/admin/safety-meetings', label: 'Safety' },
  { href: '/admin/map',             label: 'Live Map' },
  { href: '/admin/payroll',         label: 'Payroll' },
  { href: '/admin/fatigue',         label: 'Fatigue' },
  { href: '/admin/emergency',       label: 'Emergency' },
  { href: '/chat',                  label: 'Chat' },
  { href: '/admin/performance',     label: 'Performance' },
  { href: '/admin/lost-found',      label: 'Lost & Found' },
  { href: '/admin/airlines',        label: 'Airlines' },
  { href: '/admin/notifications',   label: 'Notifications' },
  { href: '/admin/reports',         label: 'Reports' },
  { href: '/admin/sign-in-sheets',  label: 'Sign-In Sheets' },
  { href: '/admin/counting-sheets', label: 'Counting Sheets' },
  { href: '/admin/inspections',     label: 'Inspections' },
  { href: '/board',                 label: 'Board ↗' },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-0.5 px-3 py-1.5 w-max">
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== '/admin' && pathname.startsWith(item.href + '/')) ||
          (item.href === '/admin/employees' && pathname === '/admin')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
              active
                ? 'bg-gray-800 text-white font-medium'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
