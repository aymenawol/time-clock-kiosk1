import { getEmployeesPageAction } from "./actions"
import { EMPLOYEES_PAGE_SIZE, type EmployeeSort } from "./types"
import EmployeeDirectoryClient from "./employee-directory-client"
import Link from "next/link"

export const dynamic = "force-dynamic"

const SORTS: EmployeeSort[] = ["seniority", "hire_date", "name"]

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    role?: string
    status?: string
    sort?: string
    page?: string
  }>
}) {
  const params = await searchParams

  const query = {
    search: params.search ?? "",
    role: params.role ?? "all",
    status: params.status ?? "all",
    sort: (SORTS.includes(params.sort as EmployeeSort) ? params.sort : "seniority") as EmployeeSort,
    page: Math.max(1, parseInt(params.page ?? "1", 10) || 1),
  }

  const result = await getEmployeesPageAction(query)

  const employees = result.success ? result.data.employees : []
  const total = result.success ? result.data.total : 0
  const page = result.success ? result.data.page : query.page
  const pageSize = result.success ? result.data.pageSize : EMPLOYEES_PAGE_SIZE
  const stats = result.success
    ? result.data.stats
    : { total: 0, active: 0, onLeave: 0, terminated: 0 }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Employee Directory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats.total} total · {stats.active} active · {stats.onLeave} on leave ·{" "}
            {stats.terminated} terminated
          </p>
        </div>
        <div className="flex items-center gap-3">
          <EmployeeDirectoryClient exportOnly />
          <Link
            href="/admin/employees/new"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-foreground"
            style={{ backgroundColor: "#2563EB" }}
          >
            + Add Employee
          </Link>
        </div>
      </div>

      {/* Error state */}
      {!result.success && (
        <div className="rounded-xl bg-red-950 border border-red-800 px-4 py-3 text-red-300 text-sm">
          Failed to load employees: {result.error}
        </div>
      )}

      {/* Directory table (server-paginated) */}
      <EmployeeDirectoryClient
        employees={employees}
        total={total}
        page={page}
        pageSize={pageSize}
        query={query}
      />
    </div>
  )
}
