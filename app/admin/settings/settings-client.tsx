'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateBreakRulesAction, updateOvertimeRulesAction,
  type BreakRules, type OvertimeRules,
} from './actions'

function NumberField({ name, label, defaultValue, step }: { name: string; label: string; defaultValue: number; step?: string }) {
  return (
    <label className="block">
      <span className="text-muted-foreground text-xs">{label}</span>
      <input
        name={name}
        type="number"
        step={step ?? '1'}
        defaultValue={defaultValue}
        className="mt-1 w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm"
      />
    </label>
  )
}

export default function SettingsClient({
  breakRules,
  overtimeRules,
}: {
  breakRules: BreakRules
  overtimeRules: OvertimeRules
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function submit(action: (fd: FormData) => Promise<{ error?: string; success?: boolean }>, form: HTMLFormElement, label: string) {
    setMsg(null)
    const fd = new FormData(form)
    startTransition(async () => {
      const res = await action(fd)
      setMsg(res.error ? `${label}: ${res.error}` : `${label} saved.`)
      if (!res.error) router.refresh()
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Rules & Configuration</h1>
        <p className="text-muted-foreground text-sm">Operational rules read by the break subsystem and payroll engine.</p>
      </div>

      {msg && <div className="rounded-lg bg-muted border border-border px-3 py-2 text-sm text-gray-200">{msg}</div>}

      {/* Break rules */}
      <form
        onSubmit={(e) => { e.preventDefault(); submit(updateBreakRulesAction, e.currentTarget, 'Break rules') }}
        className="bg-card border border-border rounded-xl p-5 space-y-4"
      >
        <h2 className="text-foreground font-semibold text-sm uppercase tracking-wide">Break Rules</h2>
        <div className="grid grid-cols-2 gap-3">
          <NumberField name="break_count" label="Breaks per shift" defaultValue={breakRules.break_count} />
          <NumberField name="duration_minutes" label="Break duration (min)" defaultValue={breakRules.duration_minutes} />
          <NumberField name="flex_minutes" label="Flex window (min)" defaultValue={breakRules.flex_minutes} />
          <NumberField name="break1_after_start_minutes" label="Break 1 after start (min)" defaultValue={breakRules.break1_after_start_minutes} />
          <NumberField name="break2_before_end_minutes" label="Break 2 before end (min)" defaultValue={breakRules.break2_before_end_minutes} />
          <NumberField name="default_shift_minutes" label="Default shift length (min)" defaultValue={breakRules.default_shift_minutes} />
          <NumberField name="overstay_reminder_minutes" label="Overstay reminder (min)" defaultValue={breakRules.overstay_reminder_minutes} />
          <NumberField name="overstay_alert_minutes" label="Overstay alert (min)" defaultValue={breakRules.overstay_alert_minutes} />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input name="allow_dispatcher_override" type="checkbox" defaultChecked={breakRules.allow_dispatcher_override} className="rounded" />
          Allow dispatcher to re-enable breaks
        </label>
        <button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-foreground text-sm font-semibold px-4 py-2 rounded-lg">
          {pending ? 'Saving…' : 'Save Break Rules'}
        </button>
      </form>

      {/* Overtime rules */}
      <form
        onSubmit={(e) => { e.preventDefault(); submit(updateOvertimeRulesAction, e.currentTarget, 'Overtime rules') }}
        className="bg-card border border-border rounded-xl p-5 space-y-4"
      >
        <h2 className="text-foreground font-semibold text-sm uppercase tracking-wide">Overtime Rules</h2>
        <div className="grid grid-cols-2 gap-3">
          <NumberField name="daily_ot_threshold_hours" label="Daily OT threshold (h)" defaultValue={overtimeRules.daily_ot_threshold_hours} />
          <NumberField name="weekly_ot_threshold_hours" label="Weekly OT threshold (h)" defaultValue={overtimeRules.weekly_ot_threshold_hours} />
          <NumberField name="ot_multiplier" label="OT multiplier" defaultValue={overtimeRules.ot_multiplier} step="0.1" />
          <NumberField name="bid_cycle_months" label="Bid cycle (months)" defaultValue={overtimeRules.bid_cycle_months} />
          <label className="block">
            <span className="text-muted-foreground text-xs">Award method</span>
            <select name="award_method" defaultValue={overtimeRules.award_method}
              className="mt-1 w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm">
              <option value="seniority">Seniority</option>
              <option value="rotation">Rotation</option>
              <option value="first_come">First come</option>
            </select>
          </label>
        </div>
        <button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-foreground text-sm font-semibold px-4 py-2 rounded-lg">
          {pending ? 'Saving…' : 'Save Overtime Rules'}
        </button>
      </form>
    </div>
  )
}
