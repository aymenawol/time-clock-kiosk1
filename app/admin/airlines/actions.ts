'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getServerUser } from '@/lib/supabase-server'

async function assertAdmin() {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')
  if (user.app_metadata?.role !== 'admin') throw new Error('Admin only')
  return user
}

export interface AirlineInput {
  id?:                  string
  name:                 string
  terminal:             string
  phone:                string
  wheelchair_contact:   string
  notes:                string
  is_active:            boolean
}

export async function upsertAirlineAction(data: AirlineInput) {
  await assertAdmin()
  const admin = createSupabaseAdmin()

  const payload = {
    name:               data.name.trim(),
    terminal:           data.terminal.trim(),
    phone:              data.phone.trim(),
    wheelchair_contact: data.wheelchair_contact.trim() || null,
    notes:              data.notes.trim() || null,
    is_active:          data.is_active,
  }

  if (data.id) {
    const { error } = await admin.from('airlines').update(payload).eq('id', data.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await admin.from('airlines').insert(payload)
    if (error) return { error: error.message }
  }

  revalidatePath('/admin/airlines')
  return { success: true }
}

export async function toggleAirlineActiveAction(id: string, isActive: boolean) {
  await assertAdmin()
  const admin = createSupabaseAdmin()
  const { error } = await admin.from('airlines').update({ is_active: isActive }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/airlines')
  return { success: true }
}
