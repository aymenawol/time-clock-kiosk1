import { redirect } from "next/navigation"
import { getServerUser } from "@/lib/supabase-server"

// Role → landing dashboard. Single source of truth for post-login routing.
const DASHBOARD_FOR: Record<string, string> = {
  admin: "/admin/employees",
  management: "/admin/employees",
  driver: "/driver",
  dispatcher: "/dispatcher",
  coordinator: "/coordinator",
  supervisor: "/coordinator",
  technician: "/technician",
  fueler_washer: "/fueler",
  payroll: "/admin/payroll",
}

// Thin entry point: send authenticated users to their dashboard, everyone else to login.
// (Replaces the legacy 3,158-line client kiosk.)
export default async function Home() {
  const { user } = await getServerUser()
  if (!user) redirect("/login")

  const role = (user.app_metadata?.role as string | undefined) ?? ""
  redirect(DASHBOARD_FOR[role] ?? "/login")
}
