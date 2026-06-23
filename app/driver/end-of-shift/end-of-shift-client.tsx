'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BatteryWarning, CheckCircle2, AlertTriangle, Zap, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { submitEndOfShiftAction } from '../actions'

interface Bus { id: string; bus_number: string; bus_type: string; fuel_level: number | null }
interface Shift { id: string; bus_id: string | null; bus: Bus | null }

const DIESEL_LABELS = ['Full', 'Over 3/4', 'Over 1/2', 'Under 1/4'] as const
type DieselLabel = typeof DIESEL_LABELS[number]

const DIESEL_PCT: Record<DieselLabel, number> = {
  'Full':       100,
  'Over 3/4':   80,
  'Over 1/2':   60,
  'Under 1/4':  20,
}

const STATUS_OPTIONS = [
  { value: 'ready',           label: 'Ready for Service',   color: 'bg-ok-surface border-ok-border text-ok' },
  { value: 'charge_required', label: 'Charge Required',     color: 'bg-warn-surface border-warn-border text-warn' },
  { value: 'shop',            label: 'Needs Shop',          color: 'bg-danger-surface border-danger-border text-danger' },
  { value: 'hazard',          label: 'HAZARD — Alert Dispatch', color: 'bg-hazard-surface border-hazard-border text-hazard font-semibold' },
] as const

export default function EndOfShiftClient({ shift }: { shift: Shift | null }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const bus = shift?.bus ?? null
  const isEV = bus?.bus_type === 'EV'

  const [evBattery, setEvBattery] = useState<string>(bus?.fuel_level?.toString() ?? '')
  const [dieselLabel, setDieselLabel] = useState<DieselLabel>('Full')
  const [statusSubmitted, setStatusSubmitted] = useState<'ready' | 'charge_required' | 'shop' | 'hazard'>('ready')
  const [notes, setNotes] = useState('')

  // Auto-classify EV battery
  const evPct = parseFloat(evBattery)
  const evAutoStatus: 'ready' | 'charge_required' = !isNaN(evPct) && evPct < 50 ? 'charge_required' : 'ready'

  function handleSubmit() {
    if (!shift) { setError('No active shift found.'); return }
    setError('')

    const fuelLevelPct = isEV
      ? (!isNaN(evPct) ? evPct : null)
      : DIESEL_PCT[dieselLabel]

    startTransition(async () => {
      const res = await submitEndOfShiftAction({
        shiftId:         shift.id,
        busId:           bus?.id ?? null,
        busType:         bus?.bus_type ?? 'Diesel',
        fuelLevelPct,
        fuelLabel:       isEV ? null : dieselLabel,
        evBatteryPct:    isEV ? (isNaN(evPct) ? null : evPct) : null,
        statusSubmitted,
        notes,
      })
      if (res.error) { setError(res.error); return }
      setSubmitted(true)
    })
  }

  if (!shift) {
    return (
      <div className="text-center py-20">
        <BatteryWarning className="size-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-muted-foreground">No active shift today.</p>
        <Button variant="ghost" size="lg" onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="size-4" /> Back
        </Button>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="text-center py-20">
        <CheckCircle2 className="size-14 mx-auto mb-4 text-ok" />
        <h2 className="text-xl font-bold text-foreground mb-2">End of Shift Submitted</h2>
        <p className="text-muted-foreground text-sm mb-6">
          {bus ? `Bus #${bus.bus_number}` : 'Bus'} status has been updated.
        </p>
        <Button size="lg" onClick={() => router.push('/driver')}>
          Back to Dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <button onClick={() => router.back()} className="text-muted-foreground text-sm hover:text-foreground mb-2 inline-flex items-center gap-1">
          <ArrowLeft className="size-3.5" /> Back
        </button>
        <h1 className="text-2xl font-bold text-foreground">End of Shift</h1>
        {bus && (
          <p className="text-muted-foreground text-sm mt-1">
            Bus #{bus.bus_number} — {bus.bus_type}
          </p>
        )}
      </div>

      {error && (
        <div className="bg-danger-surface border border-danger-border text-danger rounded-lg p-3 text-sm">{error}</div>
      )}

      {/* Fuel / Battery Input */}
      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          {isEV ? 'Battery Level' : 'Fuel Level'}
        </h2>

        {isEV ? (
          <div className="space-y-1.5">
            <Label htmlFor="ev-battery">Battery % *</Label>
            <Input
              id="ev-battery"
              type="number"
              min="0"
              max="100"
              value={evBattery}
              onChange={e => setEvBattery(e.target.value)}
              placeholder="0–100"
              className="h-12 text-base"
            />
            {!isNaN(evPct) && evPct >= 0 && (
              <p className={`text-xs mt-1.5 inline-flex items-center gap-1 ${evPct >= 50 ? 'text-ok' : 'text-warn'}`}>
                {evPct >= 50
                  ? <><Check className="size-3.5" /> Ready for Service</>
                  : <><Zap className="size-3.5" /> Charge Required (below 50%)</>}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Fuel Level *</Label>
            <div className="grid grid-cols-2 gap-2">
              {DIESEL_LABELS.map(label => (
                <button
                  key={label}
                  onClick={() => setDieselLabel(label)}
                  className={`border rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                    dieselLabel === label
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-card border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Bus Status */}
      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Bus Status After Shift</h2>
        {isEV && !isNaN(evPct) && evPct >= 0 && (
          <p className="text-xs text-muted-foreground">
            EV auto-classification: <span className="text-foreground">{evAutoStatus === 'ready' ? 'Ready' : 'Charge Required'}</span>. Override below if needed.
          </p>
        )}
        <div className="space-y-2">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusSubmitted(opt.value)}
              className={`w-full border rounded-lg px-4 py-3.5 text-sm text-left transition-colors inline-flex items-center gap-2 ${
                statusSubmitted === opt.value
                  ? opt.color + ' ring-2 ring-offset-1 ring-offset-background ring-ring'
                  : 'bg-card border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {opt.value === 'hazard' && <AlertTriangle className="size-4 shrink-0" />}
              {opt.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Notes */}
      <Card className="p-4 space-y-1.5">
        <Label htmlFor="eos-notes">Notes (optional)</Label>
        <Textarea
          id="eos-notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Any issues, damage, or comments…"
          className="resize-none"
        />
      </Card>

      <Button
        size="xl"
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full"
      >
        {isPending ? 'Submitting…' : 'Submit End of Shift'}
      </Button>

      {statusSubmitted === 'hazard' && (
        <p className="text-hazard text-xs text-center inline-flex items-center justify-center gap-1 w-full">
          <AlertTriangle className="size-3.5" /> A hazard alert will be sent to dispatch and management immediately.
        </p>
      )}
    </div>
  )
}
