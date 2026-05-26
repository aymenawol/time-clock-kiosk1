"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import type { Employee, EmployeeRole } from "@/lib/supabase"
import {
  toggleEmployeeStatusAction,
  exportEmployeesCSVAction,
} from "./actions"

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-900 text-green-300",
  on_leave: "bg-yellow-900 text-yellow-300",
  terminated: "bg-red-900 text-red-400",
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  management: "Management",
  driver: "Driver",
  dispatcher: "Dispatcher",
  coordinator: "Coordinator",
  supervisor: "Supervisor",
  technician: "Technician",
  fueler_washer: "Fueler/Washer",
  payroll: "Payroll",
}

interface Category {
  label: string
  roles: string[]
  employees: Employee[]
}

interface Props {
  employees: Employee[]
  categorized?: Category[]
  exportOnly?: boolean
}

export default function EmployeeDirectoryClient({
  employees,
  categorized,
  exportOnly,
}: Props) {
  const [search, setSearch] = useState("")
  const [filterRole, setFilterRole] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"seniority" | "hire_date" | "name">("seniority")
  const [isPending, startTransition] = useTransition()
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  // ── Export CSV ──────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    startTransition(async () => {
      const result = await exportEmployeesCSVAction()
      if (!result.success) {
        setToast({ message: result.error, type: "error" })
        return
      }
      const blob = new Blob([result.data], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `employees_${new Date().toISOString().split("T")[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  // ── Toggle status ───────────────────────────────────────────────────────
  const handleToggleStatus = (emp: Employee) => {
    const newStatus = emp.status === "terminated" ? "active" : "terminated"
    setTogglingId(emp.id)
    startTransition(async () => {
      const result = await toggleEmployeeStatusAction(emp.id, newStatus)
      setTogglingId(null)
      if (result.success) {
        setToast({
          message: `${emp.name} set to ${newStatus}.`,
          type: "success",
        })
      } else {
        setToast({ message: result.error, type: "error" })
      }
    })
  }

  // ── If exportOnly, just render the CSV button ───────────────────────────
  if (exportOnly) {
    return (
      <button
        onClick={handleExportCSV}
        disabled={isPending}
        className="px-4 py-2 rounded-xl text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        Export CSV
      </button>
    )
  }

  // ── Filter + sort ───────────────────────────────────────────────────────
  const filterEmployee = (e: Employee) => {
    const matchesSearch =
      search === "" ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.employee_id.includes(search) ||
      (e.email ?? "").toLowerCase().includes(search.toLowerCase())

    const matchesRole = filterRole === "all" || e.role === filterRole
    const matchesStatus = filterStatus === "all" || e.status === filterStatus

    return matchesSearch && matchesRole && matchesStatus
  }

  const sortEmployees = (a: Employee, b: Employee) => {
    if (sortBy === "seniority") {
      if (a.seniority_number != null && b.seniority_number != null)
        return a.seniority_number - b.seniority_number
      if (a.seniority_number != null) return -1
      if (b.seniority_number != null) return 1
      // Fall back to hire date
    }
    if (sortBy === "hire_date" || sortBy === "seniority") {
      if (a.hire_date && b.hire_date)
        return a.hire_date.localeCompare(b.hire_date)
      if (a.hire_date) return -1
      if (b.hire_date) return 1
    }
    return a.name.localeCompare(b.name)
  }

  const allRoles = Array.from(
    new Set(employees.map((e) => e.role).filter(Boolean) as EmployeeRole[])
  ).sort()

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-xl ${
            toast.type === "success"
              ? "bg-green-900 text-green-200 border border-green-700"
              : "bg-red-950 text-red-300 border border-red-800"
          }`}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-3 opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-gray-900 rounded-xl p-4 border border-gray-800">
        <input
          type="text"
          placeholder="Search name, ID, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-600"
        />

        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-600"
        >
          <option value="all">All roles</option>
          {allRoles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r] ?? r}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-600"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="terminated">Terminated</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) =>
            setSortBy(e.target.value as "seniority" | "hire_date" | "name")
          }
          className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-600"
        >
          <option value="seniority">Sort: Seniority</option>
          <option value="hire_date">Sort: Hire Date</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      {/* Category sections */}
      {categorized?.map((cat) => {
        const visible = cat.employees
          .filter(filterEmployee)
          .sort(sortEmployees)
        if (visible.length === 0) return null

        return (
          <section key={cat.label} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 px-1">
              {cat.label} ({visible.length})
            </h2>
            <EmployeeTable
              employees={visible}
              onToggle={handleToggleStatus}
              togglingId={togglingId}
            />
          </section>
        )
      })}
    </div>
  )
}

// ── Table component ──────────────────────────────────────────────────────────

function EmployeeTable({
  employees,
  onToggle,
  togglingId,
}: {
  employees: Employee[]
  onToggle: (e: Employee) => void
  togglingId: string | null
}) {
  return (
    <div className="rounded-xl border border-gray-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-3 font-medium">Employee</th>
            <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Dept / Shift</th>
            <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Seniority</th>
            <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Balances</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
            <th className="text-right px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800 bg-gray-950">
          {employees.map((emp) => (
            <tr key={emp.id} className="hover:bg-gray-900 transition-colors">
              {/* Name + ID */}
              <td className="px-4 py-3">
                <div className="font-medium text-white">{emp.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  ID {emp.employee_id}
                  {emp.email && (
                    <span className="ml-2 hidden sm:inline">{emp.email}</span>
                  )}
                </div>
              </td>

              {/* Dept / Shift */}
              <td className="px-4 py-3 text-gray-300 hidden sm:table-cell">
                {emp.department && (
                  <div className="text-xs">{emp.department}</div>
                )}
                {emp.shift && (
                  <div className="text-xs text-gray-500">{emp.shift}</div>
                )}
              </td>

              {/* Seniority / Hire date */}
              <td className="px-4 py-3 text-gray-300 hidden md:table-cell">
                {emp.seniority_number != null ? (
                  <span className="font-mono text-xs">#{emp.seniority_number}</span>
                ) : (
                  <span className="text-gray-600">—</span>
                )}
                {emp.hire_date && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {new Date(emp.hire_date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                )}
              </td>

              {/* Balances */}
              <td className="px-4 py-3 hidden lg:table-cell">
                <div className="text-xs text-gray-400 space-y-0.5">
                  <div>PTO: <span className="text-white">{emp.pto_balance}h</span></div>
                  <div>Vac: <span className="text-white">{emp.vacation_balance}h</span></div>
                  <div>FMLA: <span className="text-white">{emp.fmla_balance}h</span></div>
                </div>
              </td>

              {/* Status badge */}
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    STATUS_BADGE[emp.status] ?? "bg-gray-800 text-gray-400"
                  }`}
                >
                  {emp.status.replace("_", " ")}
                </span>
              </td>

              {/* Actions */}
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/admin/employees/${emp.id}`}
                    className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => onToggle(emp)}
                    disabled={togglingId === emp.id}
                    className={`text-xs px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40 ${
                      emp.status === "terminated"
                        ? "text-green-400 hover:text-green-300 bg-green-950 hover:bg-green-900"
                        : "text-red-400 hover:text-red-300 bg-red-950 hover:bg-red-900"
                    }`}
                  >
                    {togglingId === emp.id
                      ? "…"
                      : emp.status === "terminated"
                      ? "Reactivate"
                      : "Deactivate"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
