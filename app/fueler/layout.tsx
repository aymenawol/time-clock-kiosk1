import { redirect } from 'next/navigation'
import { getShellUser } from '@/lib/supabase-server'
import { FieldShell } from '@/components/app-shell/field-shell'

const FUELER_ROLES = ['admin', 'management', 'fueler_washer']

export default async function FuelerLayout({ children }: { children: React.ReactNode }) {
  const { user, role, name } = await getShellUser()
  if (!user) redirect('/')
  if (!FUELER_ROLES.includes(role ?? '')) redirect('/unauthorized')

  return (
    <FieldShell variant="fueler" name={name}>
      {children}
    </FieldShell>
  )
}
