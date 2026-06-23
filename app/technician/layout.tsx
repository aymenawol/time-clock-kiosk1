import { redirect } from 'next/navigation'
import { getShellUser } from '@/lib/supabase-server'
import { OfficeShell } from '@/components/app-shell/office-shell'

const TECHNICIAN_ROLES = ['admin', 'management', 'technician']

export default async function TechnicianLayout({ children }: { children: React.ReactNode }) {
  const { user, role, name, email } = await getShellUser()
  if (!user) redirect('/')
  if (!TECHNICIAN_ROLES.includes(role ?? '')) redirect('/unauthorized')

  return (
    <OfficeShell navKey="technician" role={role!} name={name} email={email}>
      {children}
    </OfficeShell>
  )
}
