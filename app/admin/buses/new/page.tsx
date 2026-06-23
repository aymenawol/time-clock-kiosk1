'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { createBusAction } from '../actions'

export default function NewBusPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    bus_number:      '',
    vin:             '',
    bus_type:        'Diesel' as 'EV' | 'Diesel',
    fuel_level:      '' as string,
    current_mileage: '' as string,
    notes:           '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await createBusAction({
        bus_number:      form.bus_number,
        vin:             form.vin || undefined,
        bus_type:        form.bus_type,
        fuel_level:      form.fuel_level ? parseFloat(form.fuel_level) : undefined,
        current_mileage: form.current_mileage ? parseInt(form.current_mileage) : undefined,
        notes:           form.notes || undefined,
      })
      if (result.error) {
        setError(result.error)
      } else {
        router.push('/admin/buses')
      }
    })
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Add New Bus</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-danger-surface border border-danger-border text-danger rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="bus_number">Bus Number *</Label>
            <Input
              id="bus_number"
              name="bus_number"
              required
              value={form.bus_number}
              onChange={handleChange}
              placeholder="e.g. 42"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bus_type">Type *</Label>
            <select
              id="bus_type"
              name="bus_type"
              value={form.bus_type}
              onChange={handleChange}
              className="flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:border-ring"
            >
              <option value="Diesel">Diesel</option>
              <option value="EV">EV</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vin">VIN</Label>
          <Input
            id="vin"
            name="vin"
            value={form.vin}
            onChange={handleChange}
            placeholder="Vehicle Identification Number"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="fuel_level">
              {form.bus_type === 'EV' ? 'Charge Level (%)' : 'Fuel Level (%)'}
            </Label>
            <Input
              id="fuel_level"
              name="fuel_level"
              type="number"
              min="0"
              max="100"
              step="1"
              value={form.fuel_level}
              onChange={handleChange}
              placeholder="0–100"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="current_mileage">Current Mileage</Label>
            <Input
              id="current_mileage"
              name="current_mileage"
              type="number"
              min="0"
              value={form.current_mileage}
              onChange={handleChange}
              placeholder="Odometer reading"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} className="flex-1">
            {isPending ? 'Adding…' : 'Add Bus'}
          </Button>
        </div>
      </form>
    </div>
  )
}
