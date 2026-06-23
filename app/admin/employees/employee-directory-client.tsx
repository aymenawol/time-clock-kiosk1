"use client"

import { useState, useTransition, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  toggleEmployeeStatusAction,
  exportEmployeesCSVAction,
} from "./actions"
import type { DirectoryEmployee, EmployeeSort } from "./types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Pencil,
  UserCheck,
  UserX,
  X,
} from "lucide-react"

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  active: "ok",
  on_leave: "warn",
  terminated: "danger",
}

const SELECT_CLS =
  "h-10 rounded-lg bg-card border border-input px-3 py-2 text-foreground text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:border-ring"

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
      <Button variant="secondary" onClick={handleExportCSV} disabled={isPending}>
        <Download />
        Export CSV
      </Button>
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
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-xl border ${
            toast.type === "success"
              ? "bg-ok-surface text-ok border-ok-border"
              : "bg-danger-surface text-danger border-danger-border"
          }`}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="opacity-60 hover:opacity-100"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 bg-card rounded-xl p-4 border border-border sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-0 sm:min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search name, ID, or email…"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          value={role}
          onChange={(e) => router.push(buildUrl({ role: e.target.value, page: 1 }))}
          className={SELECT_CLS}
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
          className={SELECT_CLS}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="terminated">Terminated</option>
        </select>

        <select
          value={sort}
          onChange={(e) => router.push(buildUrl({ sort: e.target.value as EmployeeSort, page: 1 }))}
          className={SELECT_CLS}
        >
          <option value="seniority">Sort: Seniority</option>
          <option value="hire_date">Sort: Hire Date</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      {/* Table */}
      {employees.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
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
      <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">
          {total === 0 ? "No results" : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => router.push(buildUrl({ page: page - 1 }))}
            >
              <ChevronLeft />
              Prev
            </Button>
            <span className="text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => router.push(buildUrl({ page: page + 1 }))}
            >
              Next
              <ChevronRight />
            </Button>
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
    <div className="rounded-xl border border-border overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
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
        <tbody className="divide-y divide-border bg-card">
          {employees.map((emp) => (
            <tr key={emp.id} className="hover:bg-accent transition-colors">
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
                {emp.role ? ROLE_LABEL[emp.role] ?? emp.role : <span className="text-muted-foreground">—</span>}
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
                  <span className="text-muted-foreground">—</span>
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
                <Badge variant={STATUS_VARIANT[emp.status] ?? "neutral"}>
                  {emp.status.replace("_", " ")}
                </Badge>
              </td>

              {/* Actions */}
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/admin/employees/${emp.id}`}>
                      <Pencil />
                      Edit
                    </Link>
                  </Button>
                  <Button
                    variant={emp.status === "terminated" ? "success" : "destructive"}
                    size="sm"
                    onClick={() => onToggle(emp)}
                    disabled={togglingId === emp.id}
                  >
                    {togglingId === emp.id ? (
                      "…"
                    ) : emp.status === "terminated" ? (
                      <>
                        <UserCheck />
                        Reactivate
                      </>
                    ) : (
                      <>
                        <UserX />
                        Deactivate
                      </>
                    )}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
