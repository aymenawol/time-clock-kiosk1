"use client"

import { useState, useTransition, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  toggleEmployeeStatusAction,
  exportEmployeesCSVAction,
} from "./actions"
import type { DirectoryEmployee, EmployeeSort } from "./types"

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

interface Query {
  search: string
  role: string
  status: string
  sort: EmployeeSort
}

interface Props {
  employees?: DirectoryEmployee[]
  total?: number
  page?: number
  pageSize?: number
  query?: Query
  exportOnly?: boolean
}

export default function EmployeeDirectoryClient({
  employees = [],
  total = 0,
  page = 1,
  pageSize = 25,
  query,
  exportOnly,
}: Props) {
  const router = useRouter()
  const role = query?.role ?? "all"
  const status = query?.status ?? "all"
  const sort = query?.sort ?? "seniority"

  const [searchInput, setSearchInput] = useState(query?.search ?? "")
  const [isPending, startTransition] = useTransition()
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep the input in sync when the URL changes externally (e.g. back/forward).
  useEffect(() => {
    setSearchInput(query?.search ?? "")
  }, [query?.search])

  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current) }, [])

  // ── URL helpers ───────────────────────────────────────────────────────────
  const buildUrl = useCallback(
    (overrides: Partial<Query & { page: number }>) => {
      const next = {
        search: searchInput,
        role,
        status,
        sort,
        page: 1,
        ...overrides,
      }
      const sp = new URLSearchParams()
      if (next.search) sp.set("search", next.search)
      if (next.role && next.role !== "all") sp.set("role", next.role)
      if (next.status && next.status !== "all") sp.set("status", next.status)
      if (next.sort && next.sort !== "seniority") sp.set("sort", next.sort)
      if (next.page && next.page > 1) sp.set("page", String(next.page))
      const qs = sp.toString()
      return qs ? `/admin/employees?${qs}` : "/admin/employees"
    },
    [searchInput, role, status, sort]
  )

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      // buildUrl reads searchInput via closure; recompute from the latest value.
      const sp = new URLSearchParams()
      if (value) sp.set("search", value)
      if (role !== "all") sp.set("role", role)
      if (status !== "all") sp.set("status", status)
      if (sort !== "seniority") sp.set("sort", sort)
      const qs = sp.toString()
      router.push(qs ? `/admin/employees?${qs}` : "/admin/employees")
    }, 350)
  }

  // ── Export CSV (full directory, not just the current page) ──────────────────
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
  const handleToggleStatus = (emp: DirectoryEmployee) => {
    const newStatus = emp.status === "terminated" ? "active" : "terminated"
    setTogglingId(emp.id)
    startTransition(async () => {
      const result = await toggleEmployeeStatusAction(emp.id, newStatus)
      setTogglingId(null)
      if (result.success) {
        setToast({ message: `${emp.name} set to ${newStatus}.`, type: "success" })
        router.refresh()
      } else {
        setToast({ message: result.error, type: "error" })
      }
    })
  }

  // ── exportOnly variant: just the CSV button (rendered in the page header) ───
  if (exportOnly) {
    return (
      <button
        onClick={handleExportCSV}
        disabled={isPending}
        className="px-4 py-2 rounded-xl text-sm font-medium text-foreground bg-muted hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        Export CSV
      </button>
    )
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)

  return (
    <div className="space-y-4">
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
          <button onClick={() => setToast(null)} className="ml-3 opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-card rounded-xl p-4 border border-border">
        <input
          type="text"
          placeholder="Search name, ID, or email…"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="flex-1 min-w-48 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-600"
        />

        <select
          value={role}
          onChange={(e) => router.push(buildUrl({ role: e.target.value, page: 1 }))}
          className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-red-600"
        >
          <option value="all">All roles</option>
          {Object.entries(ROLE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => router.push(buildUrl({ status: e.target.value, page: 1 }))}
          className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-red-600"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="terminated">Terminated</option>
        </select>

        <select
          value={sort}
          onChange={(e) => router.push(buildUrl({ sort: e.target.value as EmployeeSort, page: 1 }))}
          className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-red-600"
        >
          <option value="seniority">Sort: Seniority</option>
          <option value="hire_date">Sort: Hire Date</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      {/* Table */}
      {employees.length === 0 ? (
        <div className="rounded-xl border border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
          No employees match the current filters.
        </div>
      ) : (
        <EmployeeTable
          employees={employees}
          onToggle={handleToggleStatus}
          togglingId={togglingId}
        />
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          {total === 0 ? "No results" : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => router.push(buildUrl({ page: page - 1 }))}
              className="bg-muted hover:bg-gray-700 text-foreground px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <span className="text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => router.push(buildUrl({ page: page + 1 }))}
              className="bg-muted hover:bg-gray-700 text-foreground px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Table component ──────────────────────────────────────────────────────────

function EmployeeTable({
  employees,
  onToggle,
  togglingId,
}: {
  employees: DirectoryEmployee[]
  onToggle: (e: DirectoryEmployee) => void
  togglingId: string | null
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-card text-muted-foreground text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-3 font-medium">Employee</th>
            <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Role</th>
            <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Dept / Shift</th>
            <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Seniority</th>
            <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Balances</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
            <th className="text-right px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-background">
          {employees.map((emp) => (
            <tr key={emp.id} className="hover:bg-card transition-colors">
              {/* Name + ID */}
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">{emp.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  ID {emp.employee_id}
                  {emp.email && <span className="ml-2 hidden sm:inline">{emp.email}</span>}
                </div>
              </td>

              {/* Role */}
              <td className="px-4 py-3 text-foreground hidden sm:table-cell text-xs">
                {emp.role ? ROLE_LABEL[emp.role] ?? emp.role : <span className="text-gray-600">—</span>}
              </td>

              {/* Dept / Shift */}
              <td className="px-4 py-3 text-foreground hidden sm:table-cell">
                {emp.department && <div className="text-xs">{emp.department}</div>}
                {emp.shift && <div className="text-xs text-muted-foreground">{emp.shift}</div>}
              </td>

              {/* Seniority / Hire date */}
              <td className="px-4 py-3 text-foreground hidden md:table-cell">
                {emp.seniority_number != null ? (
                  <span className="font-mono text-xs">#{emp.seniority_number}</span>
                ) : (
                  <span className="text-gray-600">—</span>
                )}
                {emp.hire_date && (
                  <div className="text-xs text-muted-foreground mt-0.5">
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
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>PTO: <span className="text-foreground">{emp.pto_balance}h</span></div>
                  <div>Vac: <span className="text-foreground">{emp.vacation_balance}h</span></div>
                  <div>FMLA: <span className="text-foreground">{emp.fmla_balance}h</span></div>
                </div>
              </td>

              {/* Status badge */}
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    STATUS_BADGE[emp.status] ?? "bg-muted text-muted-foreground"
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
                    className="text-xs text-muted-foreground hover:text-foreground bg-muted hover:bg-gray-700 px-2.5 py-1 rounded-lg transition-colors"
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
