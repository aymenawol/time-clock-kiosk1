'use client'
import { useTransition, useState } from 'react'
import { createCycleAction } from '../actions'

export default function NewBidCycleClient() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await createCycleAction(fd)
      } catch (err: any) {
        setError(err.message ?? 'Failed to create cycle')
      }
    })
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">New Bid Cycle</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Cycle Name *</label>
          <input name="name" required className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm" placeholder="e.g. Summer 2026 Bid" />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Description</label>
          <textarea name="description" rows={2} className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Shift Period Start *</label>
            <input name="start_date" type="date" required className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Shift Period End *</label>
            <input name="end_date" type="date" required className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Submission Opens</label>
            <input name="submission_open_at" type="datetime-local" className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Submission Closes</label>
            <input name="submission_close_at" type="datetime-local" className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm" />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors"
          >
            {pending ? 'Creating...' : 'Create Cycle'}
          </button>
          <a href="/admin/bids" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded transition-colors">
            Cancel
          </a>
        </div>
      </form>
    </div>
  )
}
