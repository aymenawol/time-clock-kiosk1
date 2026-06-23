'use client'
import { useTransition, useState } from 'react'
import Link from 'next/link'
import { createCycleAction } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">New Bid Cycle</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="bc-name">Cycle Name *</Label>
          <Input id="bc-name" name="name" required placeholder="e.g. Summer 2026 Bid" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bc-description">Description</Label>
          <Textarea id="bc-description" name="description" rows={2} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bc-start">Shift Period Start *</Label>
            <Input id="bc-start" name="start_date" type="date" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bc-end">Shift Period End *</Label>
            <Input id="bc-end" name="end_date" type="date" required />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bc-open">Submission Opens</Label>
            <Input id="bc-open" name="submission_open_at" type="datetime-local" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bc-close">Submission Closes</Label>
            <Input id="bc-close" name="submission_close_at" type="datetime-local" />
          </div>
        </div>

        {error && <p className="text-danger text-sm">{error}</p>}

        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Creating...' : 'Create Cycle'}
          </Button>
          <Button asChild variant="secondary">
            <Link href="/admin/bids">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
