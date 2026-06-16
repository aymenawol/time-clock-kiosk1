"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { inviteEmployeeAction } from "../actions"
import type { InviteEmployeeInput } from "../actions"
import type { EmployeeRole } from "@/lib/supabase"
import Link from "next/link"

const ROLES: { value: EmployeeRole; label: string }[] = [
  { value: "driver",        label: "Driver / Operator" },
  { value: "dispatcher",    label: "Dispatcher" },
  { value: "coordinator",   label: "Coordinator" },
  { value: "supervisor",    label: "Supervisor" },
  { value: "technician",    label: "Technician" },
  { value: "fueler_washer", label: "Fueler / Washer" },
  { value: "payroll",       label: "Payroll" },
  { value: "management",    label: "Management" },
  { value: "admin",         label: "Administrator" },
]

const DEPARTMENTS = [
  "Operations",
  "Dispatch",
  "Maintenance",
  "Fleet",
  "Payroll",
  "Administration",
]

export default function NewEmployeePage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [invited, setInvited] = useState<string | null>(null)

  const [form, setForm] = useState<{
    employee_id: string
    name: string
    email: string
    phone: string
    hire_date: string
    seniority_number: string
    department: string
    role: EmployeeRole | ""
    shift: string
    pto_balance: string
    vacation_balance: string
    fmla_balance: string
  }>({
    employee_id: "",
    name: "",
    email: "",
    phone: "",
    hire_date: "",
    seniority_number: "",
    department: "",
    role: "",
    shift: "",
    pto_balance: "0",
    vacation_balance: "0",
    fmla_balance: "0",
  })

  const set = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.role) {
      setError("Role is required.")
      return
    }

    const input: InviteEmployeeInput = {
      employee_id: form.employee_id.trim(),
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role as EmployeeRole,
      phone: form.phone.trim() || undefined,
      hire_date: form.hire_date || undefined,
      seniority_number: form.seniority_number
        ? Number(form.seniority_number)
        : undefined,
      department: form.department || undefined,
      shift: form.shift.trim() || undefined,
      pto_balance: Number(form.pto_balance) || 0,
      vacation_balance: Number(form.vacation_balance) || 0,
      fmla_balance: Number(form.fmla_balance) || 0,
    }

    startTransition(async () => {
      const result = await inviteEmployeeAction(input)
      if (result.success) {
        setInvited(form.email.trim())
        setTimeout(() => router.push("/admin/employees"), 2500)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/employees"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Employees
        </Link>
        <h1 className="text-xl font-bold text-foreground">Add Employee</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-card rounded-2xl p-6 border border-border space-y-5"
      >
        {/* Identity */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Employee ID *">
            <input
              required
              value={form.employee_id}
              onChange={(e) => set("employee_id", e.target.value)}
              placeholder="e.g. 1234"
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Full Name *">
            <input
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="First Last"
              className={INPUT_CLS}
            />
          </Field>
        </div>

        {/* Role + Dept */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Role *">
            <select
              required
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              className={INPUT_CLS}
            >
              <option value="">Select role…</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Department">
            <select
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
              className={INPUT_CLS}
            >
              <option value="">Select department…</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Contact */}
        <hr className="border-border" />
        <p className="text-xs text-muted-foreground">
          An invite email will be sent so the employee can set their own password.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email *">
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="employee@example.com"
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Phone">
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="(555) 000-0000"
              className={INPUT_CLS}
            />
          </Field>
        </div>

        {/* Employment details */}
        <hr className="border-border" />
        <div className="grid grid-cols-3 gap-4">
          <Field label="Hire Date">
            <input
              type="date"
              value={form.hire_date}
              onChange={(e) => set("hire_date", e.target.value)}
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Seniority #">
            <input
              type="number"
              min={1}
              value={form.seniority_number}
              onChange={(e) => set("seniority_number", e.target.value)}
              placeholder="e.g. 42"
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Shift">
            <input
              value={form.shift}
              onChange={(e) => set("shift", e.target.value)}
              placeholder="e.g. AM / PM"
              className={INPUT_CLS}
            />
          </Field>
        </div>

        {/* Leave balances */}
        <hr className="border-border" />
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
          Leave Balances (hours)
        </p>
        <div className="grid grid-cols-3 gap-4">
          <Field label="PTO">
            <input
              type="number"
              min={0}
              step={0.5}
              value={form.pto_balance}
              onChange={(e) => set("pto_balance", e.target.value)}
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Vacation">
            <input
              type="number"
              min={0}
              step={0.5}
              value={form.vacation_balance}
              onChange={(e) => set("vacation_balance", e.target.value)}
              className={INPUT_CLS}
            />
          </Field>
          <Field label="FMLA">
            <input
              type="number"
              min={0}
              step={0.5}
              value={form.fmla_balance}
              onChange={(e) => set("fmla_balance", e.target.value)}
              className={INPUT_CLS}
            />
          </Field>
        </div>

        {error && (
          <div className="rounded-xl bg-red-950 border border-red-800 px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {invited && (
          <div className="rounded-xl bg-green-950 border border-green-800 px-4 py-3 text-green-300 text-sm">
            Invite sent to <strong>{invited}</strong>. Redirecting…
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/admin/employees"
            className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground bg-muted hover:bg-gray-700 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2 rounded-xl text-sm font-semibold text-foreground disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: "#2563EB" }}
          >
            {isPending ? "Sending Invite…" : "Create & Send Invite"}
          </button>
        </div>
      </form>
    </div>
  )
}

const INPUT_CLS =
  "w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-600"

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}
