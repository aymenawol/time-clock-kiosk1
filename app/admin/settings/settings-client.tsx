'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  updateBreakRulesAction, updateOvertimeRulesAction,
  type BreakRules, type OvertimeRules,
} from './actions'

function NumberField({ name, label, defaultValue, step }: { name: string; label: string; defaultValue: number; step?: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name} className="text-xs text-muted-foreground font-normal">{label}</Label>
      <Input
        id={name}
        name={name}
        type="number"
        step={step ?? '1'}
        defaultValue={defaultValue}
      />
    </div>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Rules & Configuration</h1>
        <p className="text-muted-foreground text-sm">Operational rules read by the break subsystem and payroll engine.</p>
      </div>

      {msg && <div className="rounded-lg bg-muted border border-border px-3 py-2 text-sm text-foreground">{msg}</div>}

      {/* Break rules */}
      <Card>
        <CardContent className="p-5">
          <form
            onSubmit={(e) => { e.preventDefault(); submit(updateBreakRulesAction, e.currentTarget, 'Break rules') }}
            className="space-y-4"
          >
            <h2 className="text-foreground font-semibold text-sm uppercase tracking-wide">Break Rules</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberField name="break_count" label="Breaks per shift" defaultValue={breakRules.break_count} />
              <NumberField name="duration_minutes" label="Break duration (min)" defaultValue={breakRules.duration_minutes} />
              <NumberField name="flex_minutes" label="Flex window (min)" defaultValue={breakRules.flex_minutes} />
              <NumberField name="break1_after_start_minutes" label="Break 1 after start (min)" defaultValue={breakRules.break1_after_start_minutes} />
              <NumberField name="break2_before_end_minutes" label="Break 2 before end (min)" defaultValue={breakRules.break2_before_end_minutes} />
              <NumberField name="default_shift_minutes" label="Default shift length (min)" defaultValue={breakRules.default_shift_minutes} />
              <NumberField name="overstay_reminder_minutes" label="Overstay reminder (min)" defaultValue={breakRules.overstay_reminder_minutes} />
              <NumberField name="overstay_alert_minutes" label="Overstay alert (min)" defaultValue={breakRules.overstay_alert_minutes} />
            </div>
            <Label className="flex items-center gap-2 font-normal">
              <input name="allow_dispatcher_override" type="checkbox" defaultChecked={breakRules.allow_dispatcher_override} className="rounded" />
              Allow dispatcher to re-enable breaks
            </Label>
            <Button type="submit" disabled={pending} size="sm">
              {pending ? 'Saving…' : 'Save Break Rules'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Overtime rules */}
      <Card>
        <CardContent className="p-5">
          <form
            onSubmit={(e) => { e.preventDefault(); submit(updateOvertimeRulesAction, e.currentTarget, 'Overtime rules') }}
            className="space-y-4"
          >
            <h2 className="text-foreground font-semibold text-sm uppercase tracking-wide">Overtime Rules</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumberField name="daily_ot_threshold_hours" label="Daily OT threshold (h)" defaultValue={overtimeRules.daily_ot_threshold_hours} />
              <NumberField name="weekly_ot_threshold_hours" label="Weekly OT threshold (h)" defaultValue={overtimeRules.weekly_ot_threshold_hours} />
              <NumberField name="ot_multiplier" label="OT multiplier" defaultValue={overtimeRules.ot_multiplier} step="0.1" />
              <NumberField name="bid_cycle_months" label="Bid cycle (months)" defaultValue={overtimeRules.bid_cycle_months} />
              <div className="space-y-1">
                <Label htmlFor="award_method" className="text-xs text-muted-foreground font-normal">Award method</Label>
                <select id="award_method" name="award_method" defaultValue={overtimeRules.award_method}
                  className="h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:border-ring">
                  <option value="seniority">Seniority</option>
                  <option value="rotation">Rotation</option>
                  <option value="first_come">First come</option>
                </select>
              </div>
            </div>
            <Button type="submit" disabled={pending} size="sm">
              {pending ? 'Saving…' : 'Save Overtime Rules'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
