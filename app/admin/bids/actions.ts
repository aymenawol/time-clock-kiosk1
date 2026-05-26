'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import { ShiftBidCycle, ShiftBidSlot } from '@/lib/supabase'

// ── Cycle ──────────────────────────────────────────────────────────────────────

export async function createCycleAction(formData: FormData) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('shift_bid_cycles')
    .insert({
      name:                  formData.get('name') as string,
      description:           (formData.get('description') as string) || null,
      start_date:            formData.get('start_date') as string,
      end_date:              formData.get('end_date') as string,
      submission_open_at:    (formData.get('submission_open_at') as string) || null,
      submission_close_at:   (formData.get('submission_close_at') as string) || null,
      status:                'draft',
      created_by:            user.id,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  redirect(`/admin/bids/${data.id}`)
}

export async function updateCycleStatusAction(cycleId: string, status: ShiftBidCycle['status']) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createSupabaseServerClient()
  const extra = status === 'awarded' ? { awarded_at: new Date().toISOString(), awarded_by: user.id } : {}
  const { error } = await supabase.from('shift_bid_cycles').update({ status, ...extra }).eq('id', cycleId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/bids/${cycleId}`)
  revalidatePath('/admin/bids')
}

// ── Slots ──────────────────────────────────────────────────────────────────────

export async function addSlotAction(cycleId: string, formData: FormData) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createSupabaseServerClient()
  const days = ['sun','mon','tue','wed','thu','fri','sat']
  const dayFields: Record<string, boolean> = {}
  days.forEach(d => { dayFields[`days_${d}`] = formData.get(`days_${d}`) === 'true' })

  const { error } = await supabase.from('shift_bid_slots').insert({
    cycle_id:    cycleId,
    bid_number:  Number(formData.get('bid_number')),
    shift_start: formData.get('shift_start') as string,
    shift_end:   formData.get('shift_end') as string,
    report_time: formData.get('report_time') as string,
    ...dayFields,
    route_type:  formData.get('route_type') as ShiftBidSlot['route_type'],
    max_drivers: Number(formData.get('max_drivers') || 1),
    notes:       (formData.get('notes') as string) || null,
  })
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/bids/${cycleId}`)
}

export async function deleteSlotAction(cycleId: string, slotId: string) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('shift_bid_slots').delete().eq('id', slotId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/bids/${cycleId}`)
}

// ── Award Engine ───────────────────────────────────────────────────────────────
// Assigns employees to slots by seniority. Each employee gets their highest
// available preference (1 → 2 → 3). After all submitters, remaining slots go to
// non-submitters in seniority order.

export async function runAwardEngineAction(cycleId: string) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createSupabaseServerClient()

  // Load slots with current fill counts
  const { data: slots } = await supabase.from('shift_bid_slots').select('*').eq('cycle_id', cycleId)
  if (!slots?.length) throw new Error('No slots defined for this cycle')

  // Load submissions
  const { data: submissions } = await supabase
    .from('shift_bid_submissions')
    .select('*, employees(seniority_number, hire_date)')
    .eq('cycle_id', cycleId)

  // Load existing awards to avoid duplicates
  const { data: existing } = await supabase.from('shift_bid_awards').select('employee_id').eq('cycle_id', cycleId)
  const alreadyAwarded = new Set((existing ?? []).map((a: any) => a.employee_id))

  // Track slot fill counts
  const fillCounts: Record<string, number> = {}
  slots.forEach((s: any) => { fillCounts[s.id] = 0 })
  const { data: existingAwards } = await supabase.from('shift_bid_awards').select('slot_id').eq('cycle_id', cycleId)
  ;(existingAwards ?? []).forEach((a: any) => { if (fillCounts[a.slot_id] !== undefined) fillCounts[a.slot_id]++ })

  const slotMap: Record<string, any> = {}
  slots.forEach((s: any) => { slotMap[s.id] = s })

  // Sort submitters by seniority_number ASC, hire_date ASC
  const sortedSubs = [...(submissions ?? [])].sort((a, b) => {
    const sA = (a as any).employees?.seniority_number ?? 9999
    const sB = (b as any).employees?.seniority_number ?? 9999
    if (sA !== sB) return sA - sB
    const hA = (a as any).employees?.hire_date ?? '9999-99-99'
    const hB = (b as any).employees?.hire_date ?? '9999-99-99'
    return hA < hB ? -1 : hA > hB ? 1 : 0
  })

  const toInsert: any[] = []

  for (const sub of sortedSubs) {
    if (alreadyAwarded.has((sub as any).employee_id)) continue
    const prefs: { slot_id: string; rank: number }[] = (sub as any).preferences ?? []
    const sortedPrefs = [...prefs].sort((a, b) => a.rank - b.rank)
    let awarded = false
    for (const pref of sortedPrefs) {
      const slot = slotMap[pref.slot_id]
      if (!slot) continue
      if ((fillCounts[pref.slot_id] ?? 0) < slot.max_drivers) {
        toInsert.push({
          cycle_id:        cycleId,
          employee_id:     (sub as any).employee_id,
          slot_id:         pref.slot_id,
          preference_rank: pref.rank,
          award_method:    'seniority',
          awarded_by:      user.id,
        })
        fillCounts[pref.slot_id] = (fillCounts[pref.slot_id] ?? 0) + 1
        alreadyAwarded.add((sub as any).employee_id)
        awarded = true
        break
      }
    }
    if (!awarded) {
      // Find first available slot (any)
      for (const slot of slots) {
        if ((fillCounts[(slot as any).id] ?? 0) < (slot as any).max_drivers) {
          toInsert.push({
            cycle_id:        cycleId,
            employee_id:     (sub as any).employee_id,
            slot_id:         (slot as any).id,
            preference_rank: null,
            award_method:    'seniority',
            awarded_by:      user.id,
          })
          fillCounts[(slot as any).id] = (fillCounts[(slot as any).id] ?? 0) + 1
          alreadyAwarded.add((sub as any).employee_id)
          break
        }
      }
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('shift_bid_awards').insert(toInsert)
    if (error) throw new Error(error.message)
  }

  revalidatePath(`/admin/bids/${cycleId}`)
  return { awarded: toInsert.length }
}

export async function overrideAwardAction(
  cycleId: string,
  employeeId: string,
  slotId: string,
  reason: string
) {
  const { user } = await getServerUser()
  if (!user) throw new Error('Unauthorized')

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('shift_bid_awards')
    .upsert({
      cycle_id:        cycleId,
      employee_id:     employeeId,
      slot_id:         slotId,
      preference_rank: null,
      award_method:    'manual',
      override_reason: reason,
      awarded_by:      user.id,
    }, { onConflict: 'cycle_id,employee_id' })

  if (error) throw new Error(error.message)
  revalidatePath(`/admin/bids/${cycleId}`)
}
