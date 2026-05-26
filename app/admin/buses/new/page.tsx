'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold text-white mb-6">Add New Bus</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-900/40 border border-red-600 text-red-300 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Bus Number *</label>
            <input
              name="bus_number"
              required
              value={form.bus_number}
              onChange={handleChange}
              placeholder="e.g. 42"
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Type *</label>
            <select
              name="bus_type"
              value={form.bus_type}
              onChange={handleChange}
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
            >
              <option value="Diesel">Diesel</option>
              <option value="EV">EV</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">VIN</label>
          <input
            name="vin"
            value={form.vin}
            onChange={handleChange}
            placeholder="Vehicle Identification Number"
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {form.bus_type === 'EV' ? 'Charge Level (%)' : 'Fuel Level (%)'}
            </label>
            <input
              name="fuel_level"
              type="number"
              min="0"
              max="100"
              step="1"
              value={form.fuel_level}
              onChange={handleChange}
              placeholder="0–100"
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Current Mileage</label>
            <input
              name="current_mileage"
              type="number"
              min="0"
              value={form.current_mileage}
              onChange={handleChange}
              placeholder="Odometer reading"
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Notes</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2 rounded-lg text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm"
          >
            {isPending ? 'Adding…' : 'Add Bus'}
          </button>
        </div>
      </form>
    </div>
  )
}
