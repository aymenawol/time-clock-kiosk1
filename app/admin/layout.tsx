import { redirect } from "next/navigation"
import { getServerUserRole } from "@/lib/supabase-server"
import Link from "next/link"

const ADMIN_ROLES = ["admin", "management"]

const NAV_ITEMS = [
  { href: "/admin/employees",       label: "Employees" },
  { href: "/admin/buses",           label: "Fleet" },
  { href: "/admin/fleet-readiness", label: "Fleet Status" },
  { href: "/admin/bids",            label: "Shift Bids" },
  { href: "/admin/overtime",        label: "Overtime" },
  { href: "/admin/forms",           label: "Forms" },
  { href: "/admin/safety-meetings", label: "Safety" },
  { href: "/admin/map",             label: "Live Map" },
  { href: "/admin/payroll",         label: "Payroll" },
  { href: "/admin/fatigue",         label: "Fatigue" },
  { href: "/admin/emergency",       label: "Emergency" },
  { href: "/chat",                  label: "Chat" },
  { href: "/admin/performance",     label: "Performance" },
  { href: "/admin/lost-found",      label: "Lost & Found" },
  { href: "/admin/airlines",        label: "Airlines" },
  { href: "/admin/notifications",   label: "Notifications" },
  { href: "/admin/reports",         label: "Reports" },
  { href: "/board",                 label: "Board ↗" },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const role = await getServerUserRole()

  if (!role || !ADMIN_ROLES.includes(role)) {
    redirect("/unauthorized")
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top nav */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/admin/employees"
              className="flex items-center gap-2 font-bold text-white"
            >
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold"
                style={{ backgroundColor: "#E31E24" }}
              >
                TC
              </span>
              <span className="text-sm">Admin</span>
            </Link>

            <nav className="flex gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Kiosk
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}

// ── Client sign-out button ───────────────────────────────────────────────────

import SignOutButton from "./sign-out-button"
