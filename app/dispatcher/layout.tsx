import { redirect } from 'next/navigation'
import { getShellUser } from '@/lib/supabase-server'
import { OfficeShell } from '@/components/app-shell/office-shell'

export default async function DispatcherLayout({ children }: { children: React.ReactNode }) {
  const { user, role, name, email } = await getShellUser()
  if (!user) redirect('/login?redirectTo=/dispatcher')
  if (!['admin', 'management', 'dispatcher'].includes(role ?? '')) redirect('/unauthorized')

  return (
    <OfficeShell navKey="dispatcher" role={role!} name={name} email={email}>
      {children}
    </OfficeShell>
  )
}
