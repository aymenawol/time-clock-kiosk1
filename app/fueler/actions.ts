'use server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requireRole } from '@/lib/auth/rbac'
import { revalidatePath } from 'next/cache'
import type { BusStatus } from '@/lib/supabase'

/**
 * N5 — Fueler / Washer write actions.
 *
 * The fueler completes fuel and/or wash service and steps the bus back toward
 * service. The "Both (fuel+wash)" status (`fuel_wash`) is resolved one task at
 * a time:
 *   fuel_wash --(fueled)--> wash        (wash still owed)
 *   fuel_wash --(washed)--> fuel        (fuel still owed)
 *   fuel       --(fueled)--> ready
 *   wash       --(washed)--> ready
 * Any other current status is left unchanged (defensive: the bus left the queue
 * while the fueler was acting).
 */

type ServiceKind = 'fuel' | 'wash'

function nextStatus(current: BusStatus, kind: ServiceKind): BusStatus | null {
  if (kind === 'fuel') {
    if (current === 'fuel') return 'ready'
    if (current === 'fuel_wash') return 'wash'
    return null
  }
  // wash
  if (current === 'wash') return 'ready'
  if (current === 'fuel_wash') return 'fuel'
  return null
}

export async function completeServiceAction(
  busId: string,
  kind: ServiceKind,
  fuelLevel?: number
): Promise<{ error?: string; status?: BusStatus }> {
  const auth = await requireRole('fueler_washer', 'admin', 'management')
  if (!auth.ok) return { error: auth.error }

  if (!busId) return { error: 'Missing bus.' }

  const admin = createSupabaseAdmin()
  const { data: bus, error: busErr } = await admin
    .from('buses')
    .select('id, status')
    .eq('id', busId)
    .maybeSingle()

  if (busErr) return { error: busErr.message }
  if (!bus) return { error: 'Bus not found.' }

  const next = nextStatus(bus.status as BusStatus, kind)
  if (!next) {
    return { error: `Bus is no longer queued for ${kind === 'fuel' ? 'fueling' : 'washing'}.` }
  }

  const update: Record<string, unknown> = { status: next }
  // When fueling, optionally record the new fuel/charge level.
  if (kind === 'fuel' && typeof fuelLevel === 'number' && fuelLevel >= 0 && fuelLevel <= 100) {
    update.fuel_level = fuelLevel
  }

  const { error: updErr } = await admin.from('buses').update(update).eq('id', busId)
  if (updErr) return { error: updErr.message }

  revalidatePath('/fueler')
  revalidatePath('/board')
  revalidatePath('/admin/buses')
  return { status: next }
}
