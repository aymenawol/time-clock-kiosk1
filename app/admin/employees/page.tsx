import { getAllEmployeesAction } from "./actions"
import EmployeeDirectoryClient from "./employee-directory-client"
import Link from "next/link"
import type { Employee } from "@/lib/supabase"

// Category display config
const ROLE_CATEGORIES = [
  { roles: ["driver"],              label: "Drivers / Operators" },
  { roles: ["dispatcher"],          label: "Dispatchers" },
  { roles: ["coordinator"],         label: "Coordinators" },
  { roles: ["supervisor"],          label: "Supervisors" },
  { roles: ["technician"],          label: "Technicians" },
  { roles: ["fueler_washer"],       label: "Fuelers & Washers" },
  { roles: ["payroll"],             label: "Payroll" },
  { roles: ["management"],          label: "Management" },
  { roles: ["admin"],               label: "Administrators" },
]

export default async function EmployeesPage() {
  const result = await getAllEmployeesAction()
  const employees: Employee[] = result.success ? result.data : []

  // Bucket employees by role category
  const categorized = ROLE_CATEGORIES.map((cat) => ({
    ...cat,
    employees: employees.filter((e) => cat.roles.includes(e.role ?? "")),
  })).filter((cat) => cat.employees.length > 0)

  // Employees without a role go in an "Unassigned" bucket
  const unassigned = employees.filter((e) => !e.role)
  if (unassigned.length > 0) {
    categorized.push({ roles: [], label: "Unassigned", employees: unassigned })
  }

  const stats = {
    total: employees.length,
    active: employees.filter((e) => e.status === "active").length,
    onLeave: employees.filter((e) => e.status === "on_leave").length,
    terminated: employees.filter((e) => e.status === "terminated").length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Employee Directory</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {stats.total} total · {stats.active} active · {stats.onLeave} on leave ·{" "}
            {stats.terminated} terminated
          </p>
        </div>
        <div className="flex items-center gap-3">
          <EmployeeDirectoryClient employees={employees} exportOnly />
          <Link
            href="/admin/employees/new"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: "#E31E24" }}
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

      {/* Categories */}
      <EmployeeDirectoryClient employees={employees} categorized={categorized} />
    </div>
  )
}
