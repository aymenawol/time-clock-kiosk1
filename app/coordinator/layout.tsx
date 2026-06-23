import { redirect } from 'next/navigation'
import { getShellUser } from '@/lib/supabase-server'
import { OfficeShell } from '@/components/app-shell/office-shell'

const COORDINATOR_ROLES = ['admin', 'management', 'coordinator', 'supervisor']

export default async function CoordinatorLayout({ children }: { children: React.ReactNode }) {
  const { user, role, name, email } = await getShellUser()
  if (!user) redirect('/')
  if (!COORDINATOR_ROLES.includes(role ?? '')) redirect('/unauthorized')

  // Supervisors share the /coordinator surface but also reach the board & chat,
  // so widen their nav. Everyone else (incl. admins viewing here) gets the
  // monitor-only nav.
  const navKey = role === 'supervisor' ? 'supervisor' : 'coordinator'

  return (
    <OfficeShell navKey={navKey} role={role!} name={name} email={email}>
      {children}
    </OfficeShell>
  )
}
