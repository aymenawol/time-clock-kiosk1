"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  updateEmployeeAction,
  resetEmployeePasswordAction,
} from "../actions"
import type { UpdateEmployeeInput } from "../actions"
import type { Employee, EmployeeRole, EmployeeStatus } from "@/lib/supabase"

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

const INPUT_CLS =
  "w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-600"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
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
      <div className="flex items-center gap-3">
        <Link
          href="/admin/employees"
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← Employees
        </Link>
        <h1 className="text-xl font-bold text-white">{employee.name}</h1>
        <span className="text-xs text-gray-500 font-mono">ID {employee.employee_id}</span>
      </div>

      {/* Balances summary card */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "PTO Balance", value: `${employee.pto_balance}h` },
          { label: "Vacation Balance", value: `${employee.vacation_balance}h` },
          { label: "FMLA Balance", value: `${employee.fmla_balance}h` },
        ].map((b) => (
          <div
            key={b.label}
            className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3 text-center"
          >
            <div className="text-2xl font-bold text-white">{b.value}</div>
            <div className="text-xs text-gray-500 mt-1">{b.label}</div>
          </div>
        ))}
      </div>

      {/* Edit form */}
      <form
        onSubmit={handleSave}
        className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-5"
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full Name *">
            <input
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className={INPUT_CLS}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Role">
            <select
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              className={INPUT_CLS}
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
              className={INPUT_CLS}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Department">
            <select
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
              className={INPUT_CLS}
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
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              className={INPUT_CLS}
            />
          </Field>
        </div>

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
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Shift">
            <input
              value={form.shift}
              onChange={(e) => set("shift", e.target.value)}
              placeholder="AM / PM"
              className={INPUT_CLS}
            />
          </Field>
        </div>

        <hr className="border-gray-800" />
        <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">
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
        {successMsg && (
          <div className="rounded-xl bg-green-950 border border-green-800 px-4 py-3 text-green-300 text-sm">
            {successMsg}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/admin/employees"
            className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: "#E31E24" }}
          >
            {isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>

      {/* Password reset section */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Password Reset</h2>
          <button
            type="button"
            onClick={() => setShowPwReset(!showPwReset)}
            className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            {showPwReset ? "Cancel" : "Reset Password"}
          </button>
        </div>

        {showPwReset && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="New Password">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className={INPUT_CLS}
                />
              </Field>
              <Field label="Confirm Password">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat"
                  className={INPUT_CLS}
                />
              </Field>
            </div>
            {pwError && (
              <div className="rounded-xl bg-red-950 border border-red-800 px-4 py-3 text-red-300 text-sm">
                {pwError}
              </div>
            )}
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={isPending}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: "#E31E24" }}
            >
              {isPending ? "Resetting…" : "Set New Password"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
