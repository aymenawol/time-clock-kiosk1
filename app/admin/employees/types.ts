import type { Employee, EmployeeRole, EmployeeStatus } from "@/lib/supabase"

export interface CreateEmployeeInput {
  employee_id: string
  name: string
  email: string
  password: string
  phone?: string
  hire_date?: string
  seniority_number?: number
  department?: string
  role: EmployeeRole
  shift?: string
  pto_balance?: number
  vacation_balance?: number
  fmla_balance?: number
}

export interface UpdateEmployeeInput {
  name?: string
  email?: string
  phone?: string
  hire_date?: string
  seniority_number?: number
  department?: string
  role?: EmployeeRole
  status?: EmployeeStatus
  shift?: string
  pto_balance?: number
  vacation_balance?: number
  fmla_balance?: number
}

export interface InviteEmployeeInput {
  employee_id: string
  name: string
  email: string
  phone?: string
  hire_date?: string
  seniority_number?: number
  department?: string
  role: EmployeeRole
  shift?: string
  pto_balance?: number
  vacation_balance?: number
  fmla_balance?: number
}

export const EMPLOYEES_PAGE_SIZE = 25

export type EmployeeSort = "seniority" | "hire_date" | "name"

export interface EmployeeQuery {
  search?: string
  role?: string
  status?: string
  sort?: EmployeeSort
  page?: number
}

/** Subset of Employee returned by the directory listing (projected columns only). */
export type DirectoryEmployee = Pick<
  Employee,
  | "id"
  | "employee_id"
  | "name"
  | "email"
  | "department"
  | "shift"
  | "seniority_number"
  | "hire_date"
  | "role"
  | "status"
  | "pto_balance"
  | "vacation_balance"
  | "fmla_balance"
>

export interface EmployeesPage {
  employees: DirectoryEmployee[]
  total: number
  page: number
  pageSize: number
  stats: { total: number; active: number; onLeave: number; terminated: number }
}
