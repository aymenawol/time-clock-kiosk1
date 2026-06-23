import { getEmployeesPageAction } from "./actions"
import { EMPLOYEES_PAGE_SIZE, type EmployeeSort } from "./types"
import EmployeeDirectoryClient from "./employee-directory-client"
import { Button } from "@/components/ui/button"
import { UserPlus } from "lucide-react"
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">Employee Directory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats.total} total · {stats.active} active · {stats.onLeave} on leave ·{" "}
            {stats.terminated} terminated
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <EmployeeDirectoryClient exportOnly />
          <Button asChild>
            <Link href="/admin/employees/new">
              <UserPlus />
              Add Employee
            </Link>
          </Button>
        </div>
      </div>

      {/* Error state */}
      {!result.success && (
        <div className="rounded-xl bg-danger-surface border border-danger-border px-4 py-3 text-danger text-sm">
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
