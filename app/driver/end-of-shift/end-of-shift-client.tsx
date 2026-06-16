'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
  { value: 'ready',           label: 'Ready for Service',   color: 'bg-green-900/40 border-green-600 text-green-300' },
  { value: 'charge_required', label: 'Charge Required',     color: 'bg-yellow-900/40 border-yellow-600 text-yellow-300' },
  { value: 'shop',            label: 'Needs Shop',          color: 'bg-red-900/40 border-red-600 text-red-300' },
  { value: 'hazard',          label: '⚠ HAZARD — Alert Dispatch', color: 'bg-purple-900/50 border-purple-500 text-purple-200 font-semibold' },
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
        <p className="text-3xl mb-3">🔋</p>
        <p className="text-muted-foreground">No active shift today.</p>
        <button onClick={() => router.back()} className="mt-4 text-muted-foreground text-sm hover:text-foreground">← Back</button>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="text-center py-20">
        <p className="text-5xl mb-4">✅</p>
        <h2 className="text-xl font-bold text-foreground mb-2">End of Shift Submitted</h2>
        <p className="text-muted-foreground text-sm mb-6">
          {bus ? `Bus #${bus.bus_number}` : 'Bus'} status has been updated.
        </p>
        <button
          onClick={() => router.push('/driver')}
          className="bg-blue-600 hover:bg-blue-500 text-foreground px-6 py-2 rounded-lg text-sm"
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <button onClick={() => router.back()} className="text-muted-foreground text-sm hover:text-foreground mb-2">← Back</button>
        <h1 className="text-2xl font-bold text-foreground">End of Shift</h1>
        {bus && (
          <p className="text-muted-foreground text-sm mt-1">
            Bus #{bus.bus_number} — {bus.bus_type}
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-600 text-red-300 rounded-lg p-3 text-sm">{error}</div>
      )}

      {/* Fuel / Battery Input */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          {isEV ? 'Battery Level' : 'Fuel Level'}
        </h2>

        {isEV ? (
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Battery % *</label>
            <input
              type="number"
              min="0"
              max="100"
              value={evBattery}
              onChange={e => setEvBattery(e.target.value)}
              placeholder="0–100"
              className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm"
            />
            {!isNaN(evPct) && evPct >= 0 && (
              <p className={`text-xs mt-1.5 ${evPct >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
                {evPct >= 50 ? '✓ Ready for Service' : '⚡ Charge Required (below 50%)'}
              </p>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Fuel Level *</label>
            <div className="grid grid-cols-2 gap-2">
              {DIESEL_LABELS.map(label => (
                <button
                  key={label}
                  onClick={() => setDieselLabel(label)}
                  className={`border rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    dieselLabel === label
                      ? 'bg-blue-700 border-blue-500 text-foreground'
                      : 'bg-card border-border text-muted-foreground hover:border-gray-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bus Status */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
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
              className={`w-full border rounded-lg px-4 py-3 text-sm text-left transition-colors ${
                statusSubmitted === opt.value
                  ? opt.color + ' ring-2 ring-offset-1 ring-offset-gray-900 ring-white/30'
                  : 'bg-background border-border text-muted-foreground hover:border-gray-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="bg-card border border-border rounded-xl p-4">
        <label className="block text-xs text-muted-foreground mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Any issues, damage, or comments…"
          className="w-full bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm resize-none"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-foreground font-semibold rounded-xl text-sm"
      >
        {isPending ? 'Submitting…' : 'Submit End of Shift'}
      </button>

      {statusSubmitted === 'hazard' && (
        <p className="text-purple-400 text-xs text-center">
          ⚠ A hazard alert will be sent to dispatch and management immediately.
        </p>
      )}
    </div>
  )
}
