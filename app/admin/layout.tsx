import { redirect } from "next/navigation"
import { getShellUser } from "@/lib/supabase-server"
import { OfficeShell } from "@/components/app-shell/office-shell"

const ADMIN_ROLES = ["admin", "management"]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { role, name, email } = await getShellUser()

  if (!role || !ADMIN_ROLES.includes(role)) {
    redirect("/unauthorized")
  }

  return (
    <OfficeShell navKey="admin" role={role} name={name} email={email}>
      {children}
    </OfficeShell>
  )
}
