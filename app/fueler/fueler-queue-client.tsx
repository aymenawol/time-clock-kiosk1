'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { completeServiceAction } from './actions'

export interface QueueBus {
  id: string
  bus_number: string
  bus_type: string
  status: string
  fuel_level: number | null
}

function ServiceCard({ bus }: { bus: QueueBus }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fuelInput, setFuelInput] = useState<string>('')

  const needsFuel = bus.status === 'fuel' || bus.status === 'fuel_wash'
  const needsWash = bus.status === 'wash' || bus.status === 'fuel_wash'

  const run = (kind: 'fuel' | 'wash') => {
    setError(null)
    const fuelLevel = kind === 'fuel' && fuelInput !== '' ? Number(fuelInput) : undefined
    startTransition(async () => {
      const res = await completeServiceAction(bus.id, kind, fuelLevel)
      if (res.error) {
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-foreground font-medium">Bus #{bus.bus_number}</p>
          <p className="text-muted-foreground text-xs">{bus.bus_type}</p>
        </div>
        {bus.fuel_level != null && (
          <span
            className={`text-sm font-medium ${
              bus.fuel_level >= 50 ? 'text-green-400' : 'text-yellow-400'
            }`}
          >
            {bus.fuel_level.toFixed(0)}%
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {needsFuel && (
          <>
            <input
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              value={fuelInput}
              onChange={(e) => setFuelInput(e.target.value)}
              placeholder="Fuel %"
              className="w-20 px-2 py-2 rounded-lg bg-muted border border-border text-foreground text-sm placeholder-gray-500"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => run('fuel')}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-foreground text-sm font-semibold disabled:opacity-60"
            >
              {pending ? '…' : 'Mark Fueled'}
            </button>
          </>
        )}
        {needsWash && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run('wash')}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-foreground text-sm font-semibold disabled:opacity-60"
          >
            {pending ? '…' : 'Mark Washed'}
          </button>
        )}
        {bus.status === 'fuel_wash' && (
          <span className="text-amber-400 text-xs">Needs both — complete each task</span>
        )}
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}

export default function FuelerQueueClient({
  buses,
  emptyLabel,
}: {
  buses: QueueBus[]
  emptyLabel: string
}) {
  if (buses.length === 0) {
    return <p className="text-gray-600 text-sm px-4 py-3">{emptyLabel}</p>
  }
  return (
    <div className="divide-y divide-border">
      {buses.map((b) => (
        <ServiceCard key={b.id} bus={b} />
      ))}
    </div>
  )
}
