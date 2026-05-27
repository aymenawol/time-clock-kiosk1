import { redirect } from "next/navigation"
import { getServerUserRole } from "@/lib/supabase-server"
import Link from "next/link"
import { AdminNav } from "./admin-nav"
import SignOutButton from "@/components/sign-out-button"

const ADMIN_ROLES = ["admin", "management"]

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
      <header className="border-b border-gray-800 bg-gray-900 sticky top-0 z-40">
        {/* Title row */}
        <div className="px-4 h-11 flex items-center justify-between border-b border-gray-800/50">
          <Link
            href="/admin/employees"
            className="flex items-center gap-2 font-bold text-white text-sm"
          >
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold"
              style={{ backgroundColor: "#E31E24" }}
            >
              TC
            </span>
            <span>Admin</span>
          </Link>
          <SignOutButton />
        </div>
        {/* Scrollable nav row */}
        <div className="overflow-x-auto scrollbar-hide">
          <AdminNav />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}

