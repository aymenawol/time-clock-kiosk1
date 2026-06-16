'use client'
import { useState, useTransition } from 'react'
import { FormType, FORM_TYPE_LABELS } from '@/lib/supabase'
import { submitFormAction } from '../../actions'

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
    <div className="p-6 max-w-xl mx-auto">
      <a href="/driver/forms/new" className="text-sm text-muted-foreground hover:text-foreground mb-4 block">← Choose Form Type</a>
      <h1 className="text-2xl font-bold text-foreground mb-6">{FORM_TYPE_LABELS[formType]}</h1>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-6 space-y-4">
        {formType === 'time_off' && <TimeOffFields />}
        {formType === 'bid_vacation_change' && <BidVacationChangeFields />}
        {formType === 'incident_report' && <IncidentReportFields />}
        {formType === 'fmla_conversion' && <FmlaConversionFields />}
        {formType === 'resignation' && <ResignationFields />}

        {err && <p className="text-red-400 text-sm">{err}</p>}

        <button type="submit" disabled={pending}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-foreground font-medium rounded disabled:opacity-50">
          Submit Form
        </button>
      </form>
    </div>
  )
}

// ─── Field Sets ──────────────────────────────────────────────────────────────

function Field({ label, name, type = 'text', required = false, rows }: {
  label: string; name: string; type?: string; required?: boolean; rows?: number
}) {
  const base = 'w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm'
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}{required && ' *'}</label>
      {rows ? (
        <textarea name={name} rows={rows} required={required} className={base} />
      ) : (
        <input name={name} type={type} required={required} className={base} />
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
        <label className="block text-xs text-muted-foreground mb-1">Type *</label>
        <select name="leave_type" required className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm">
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
        <label className="block text-xs text-muted-foreground mb-1">Incident Type *</label>
        <select name="incident_type" required className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm">
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
        <label className="block text-xs text-muted-foreground mb-1">Supervisor Contacted?</label>
        <select name="supervisor_contacted" className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm">
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
        <label className="block text-xs text-muted-foreground mb-1">Apply paid vacation/PTO during leave?</label>
        <select name="vacation_pay_usage" className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-sm">
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
      <div className="bg-red-900/20 border border-red-800 rounded p-3">
        <p className="text-red-400 text-xs">
          By submitting this form you are initiating the resignation process.
          Upon approval your system access will be deactivated on your last day.
        </p>
      </div>
    </>
  )
}
