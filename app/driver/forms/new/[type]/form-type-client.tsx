'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { FormType, FORM_TYPE_LABELS } from '@/lib/supabase'
import { submitFormAction } from '../../actions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowLeft, AlertTriangle } from 'lucide-react'

interface Props { formType: FormType }

export default function FormTypeClient({ formType }: Props) {
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload: Record<string, any> = {}
    fd.forEach((val, key) => { payload[key] = val })
    setErr(null)
    startTransition(async () => {
      try { await submitFormAction(formType, payload) }
      catch (ex: any) { setErr(ex.message) }
    })
  }

  return (
    <div className="space-y-6">
      <Link href="/driver/forms/new" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 w-fit">
        <ArrowLeft className="size-4" /> Choose Form Type
      </Link>
      <h1 className="text-2xl font-bold text-foreground">{FORM_TYPE_LABELS[formType]}</h1>

      <Card>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formType === 'time_off' && <TimeOffFields />}
          {formType === 'bid_vacation_change' && <BidVacationChangeFields />}
          {formType === 'incident_report' && <IncidentReportFields />}
          {formType === 'fmla_conversion' && <FmlaConversionFields />}
          {formType === 'resignation' && <ResignationFields />}

          {err && <p className="text-danger text-sm">{err}</p>}

          <Button type="submit" size="lg" disabled={pending} className="w-full">
            Submit Form
          </Button>
        </form>
      </Card>
    </div>
  )
}

// ─── Field Sets ──────────────────────────────────────────────────────────────

const selectClass = 'w-full bg-card border border-input rounded-lg px-3 py-2.5 text-foreground text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

function Field({ label, name, type = 'text', required = false, rows }: {
  label: string; name: string; type?: string; required?: boolean; rows?: number
}) {
  return (
    <div>
      <Label className="block text-xs text-muted-foreground mb-1">{label}{required && ' *'}</Label>
      {rows ? (
        <Textarea name={name} rows={rows} required={required} />
      ) : (
        <Input name={name} type={type} required={required} />
      )}
    </div>
  )
}

function TimeOffFields() {
  return (
    <>
      <Field label="Start Date" name="start_date" type="date" required />
      <Field label="End Date" name="end_date" type="date" required />
      <div>
        <Label className="block text-xs text-muted-foreground mb-1">Type *</Label>
        <select name="leave_type" required className={selectClass}>
          <option value="vacation">Vacation</option>
          <option value="pto">PTO</option>
          <option value="jury_duty">Jury Duty</option>
          <option value="bereavement">Bereavement</option>
          <option value="birthday">Birthday Leave</option>
        </select>
      </div>
      <Field label="Comments" name="comments" rows={3} />
    </>
  )
}

function BidVacationChangeFields() {
  return (
    <>
      <Field label="Current Assignment / Shift" name="current_assignment" required />
      <Field label="Requested Change" name="requested_change" required />
      <Field label="Reason" name="reason" rows={3} required />
    </>
  )
}

function IncidentReportFields() {
  return (
    <>
      <Field label="Incident Date" name="incident_date" type="date" required />
      <Field label="Bus Number" name="bus_number" />
      <Field label="Location / Route" name="location" required />
      <div>
        <Label className="block text-xs text-muted-foreground mb-1">Incident Type *</Label>
        <select name="incident_type" required className={selectClass}>
          <option value="vehicle_collision">Vehicle Collision</option>
          <option value="property_damage">Property Damage</option>
          <option value="personal_injury">Personal Injury</option>
          <option value="near_miss">Near Miss</option>
          <option value="passenger_incident">Passenger Incident</option>
          <option value="other">Other</option>
        </select>
      </div>
      <Field label="Description of Incident" name="description" rows={5} required />
      <Field label="Witnesses (if any)" name="witnesses" rows={2} />
      <Field label="Passenger Information (names / contact, if any)" name="passenger_info" rows={2} />
      <div>
        <Label className="block text-xs text-muted-foreground mb-1">Supervisor Contacted?</Label>
        <select name="supervisor_contacted" className={selectClass}>
          <option value="">—</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>
      <Field label="Injuries / Damage Details" name="injuries_damage" rows={3} />
    </>
  )
}

function FmlaConversionFields() {
  return (
    <>
      <Field label="Leave Start Date" name="leave_start_date" type="date" required />
      <Field label="Estimated Return Date" name="estimated_return_date" type="date" />
      <Field label="Condition / Reason (medical information stays confidential)" name="condition_description" rows={3} required />
      <Field label="Healthcare Provider Name" name="provider_name" />
      <div>
        <Label className="block text-xs text-muted-foreground mb-1">Apply paid vacation/PTO during leave?</Label>
        <select name="vacation_pay_usage" className={selectClass}>
          <option value="">—</option>
          <option value="yes">Yes — use my vacation/PTO balance</option>
          <option value="no">No — unpaid FMLA</option>
        </select>
      </div>
      <Field label="Estimated Hours Used" name="hours_used" type="number" />
    </>
  )
}

function ResignationFields() {
  return (
    <>
      <Field label="Last Day of Work" name="last_day" type="date" required />
      <Field label="Reason for Resignation (optional)" name="reason" rows={3} />
      <div className="bg-danger-surface border border-danger-border rounded-lg p-3 flex items-start gap-2">
        <AlertTriangle className="size-4 text-danger shrink-0 mt-0.5" />
        <p className="text-danger text-xs min-w-0">
          By submitting this form you are initiating the resignation process.
          Upon approval your system access will be deactivated on your last day.
        </p>
      </div>
    </>
  )
}
