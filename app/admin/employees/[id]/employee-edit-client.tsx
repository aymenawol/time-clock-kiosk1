"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  updateEmployeeAction,
  resetEmployeePasswordAction,
} from "../actions"
import type { UpdateEmployeeInput } from "../types"
import type { Employee, EmployeeRole, EmployeeStatus } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft } from "lucide-react"

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

const STATUSES: { value: EmployeeStatus; label: string }[] = [
  { value: "active",      label: "Active" },
  { value: "on_leave",    label: "On Leave" },
  { value: "terminated",  label: "Terminated" },
]

const DEPARTMENTS = [
  "Operations",
  "Dispatch",
  "Maintenance",
  "Fleet",
  "Payroll",
  "Administration",
]

const SELECT_CLS =
  "w-full h-10 px-3 py-2 rounded-lg bg-card border border-input text-foreground text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:border-ring"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

export default function EmployeeEditClient({ employee }: { employee: Employee }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Password reset state
  const [showPwReset, setShowPwReset] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pwError, setPwError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: employee.name,
    email: employee.email ?? "",
    phone: employee.phone ?? "",
    hire_date: employee.hire_date ?? "",
    seniority_number: employee.seniority_number?.toString() ?? "",
    department: employee.department ?? "",
    role: employee.role ?? ("" as EmployeeRole | ""),
    status: employee.status as EmployeeStatus,
    shift: employee.shift ?? "",
    pto_balance: employee.pto_balance.toString(),
    vacation_balance: employee.vacation_balance.toString(),
    fmla_balance: employee.fmla_balance.toString(),
  })

  const set = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    const input: UpdateEmployeeInput = {
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      hire_date: form.hire_date || undefined,
      seniority_number: form.seniority_number
        ? Number(form.seniority_number)
        : undefined,
      department: form.department || undefined,
      role: (form.role as EmployeeRole) || undefined,
      status: form.status,
      shift: form.shift.trim() || undefined,
      pto_balance: Number(form.pto_balance) || 0,
      vacation_balance: Number(form.vacation_balance) || 0,
      fmla_balance: Number(form.fmla_balance) || 0,
    }

    startTransition(async () => {
      const result = await updateEmployeeAction(employee.id, input)
      if (result.success) {
        setSuccessMsg("Changes saved.")
      } else {
        setError(result.error)
      }
    })
  }

  const handlePasswordReset = () => {
    setPwError(null)
    if (newPassword.length < 8) {
      setPwError("Password must be at least 8 characters.")
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match.")
      return
    }
    startTransition(async () => {
      const result = await resetEmployeePasswordAction(employee.id, newPassword)
      if (result.success) {
        setSuccessMsg("Password reset successfully.")
        setShowPwReset(false)
        setNewPassword("")
        setConfirmPassword("")
      } else {
        setPwError(result.error)
      }
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/employees"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Employees
        </Link>
        <h1 className="text-xl font-bold text-foreground">{employee.name}</h1>
        <span className="text-xs text-muted-foreground font-mono">ID {employee.employee_id}</span>
      </div>

      {/* Balances summary card */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "PTO Balance", value: `${employee.pto_balance}h` },
          { label: "Vacation Balance", value: `${employee.vacation_balance}h` },
          { label: "FMLA Balance", value: `${employee.fmla_balance}h` },
        ].map((b) => (
          <Card key={b.label} className="px-4 py-3 text-center">
            <div className="text-2xl font-bold text-foreground">{b.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{b.label}</div>
          </Card>
        ))}
      </div>

      {/* Edit form */}
      <form
        onSubmit={handleSave}
        className="bg-card rounded-2xl p-6 border border-border space-y-5"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full Name *">
            <Input
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Role">
            <select
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">No role</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className={SELECT_CLS}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Department">
            <select
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">Select…</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Phone">
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Hire Date">
            <Input
              type="date"
              value={form.hire_date}
              onChange={(e) => set("hire_date", e.target.value)}
            />
          </Field>
          <Field label="Seniority #">
            <Input
              type="number"
              min={1}
              value={form.seniority_number}
              onChange={(e) => set("seniority_number", e.target.value)}
            />
          </Field>
          <Field label="Shift">
            <Input
              value={form.shift}
              onChange={(e) => set("shift", e.target.value)}
              placeholder="AM / PM"
            />
          </Field>
        </div>

        <Separator />
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
          Leave Balances (hours)
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="PTO">
            <Input
              type="number"
              min={0}
              step={0.5}
              value={form.pto_balance}
              onChange={(e) => set("pto_balance", e.target.value)}
            />
          </Field>
          <Field label="Vacation">
            <Input
              type="number"
              min={0}
              step={0.5}
              value={form.vacation_balance}
              onChange={(e) => set("vacation_balance", e.target.value)}
            />
          </Field>
          <Field label="FMLA">
            <Input
              type="number"
              min={0}
              step={0.5}
              value={form.fmla_balance}
              onChange={(e) => set("fmla_balance", e.target.value)}
            />
          </Field>
        </div>

        {error && (
          <div className="rounded-xl bg-danger-surface border border-danger-border px-4 py-3 text-danger text-sm">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="rounded-xl bg-ok-surface border border-ok-border px-4 py-3 text-ok text-sm">
            {successMsg}
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
          <Button asChild variant="secondary">
            <Link href="/admin/employees">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>

      {/* Password reset section */}
      <div className="bg-card rounded-2xl p-6 border border-border space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Password Reset</h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowPwReset(!showPwReset)}
          >
            {showPwReset ? "Cancel" : "Reset Password"}
          </Button>
        </div>

        {showPwReset && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="New Password">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                />
              </Field>
              <Field label="Confirm Password">
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat"
                />
              </Field>
            </div>
            {pwError && (
              <div className="rounded-xl bg-danger-surface border border-danger-border px-4 py-3 text-danger text-sm">
                {pwError}
              </div>
            )}
            <Button type="button" onClick={handlePasswordReset} disabled={isPending}>
              {isPending ? "Resetting…" : "Set New Password"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
