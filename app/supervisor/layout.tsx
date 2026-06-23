import { redirect } from 'next/navigation'
import { getShellUser } from '@/lib/supabase-server'
import { OfficeShell } from '@/components/app-shell/office-shell'

const SUPERVISOR_ROLES = ['admin', 'management', 'supervisor']

export default async function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const { user, role, name, email } = await getShellUser()
  if (!user) redirect('/')
  if (!SUPERVISOR_ROLES.includes(role ?? '')) redirect('/unauthorized')

  return (
    <OfficeShell navKey="supervisor" role={role!} name={name} email={email}>
      {children}
    </OfficeShell>
  )
}
