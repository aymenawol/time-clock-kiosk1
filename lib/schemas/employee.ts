import { z } from 'zod'

export const EMPLOYEE_ROLES = [
  'admin', 'management', 'driver', 'dispatcher', 'coordinator',
  'supervisor', 'technician', 'fueler_washer', 'payroll',
] as const

export const EMPLOYEE_STATUSES = ['active', 'on_leave', 'terminated'] as const

const roleEnum = z.enum(EMPLOYEE_ROLES)
const statusEnum = z.enum(EMPLOYEE_STATUSES)
const balance = z.number().min(0).max(9999)

export const CreateEmployeeSchema = z.object({
  employee_id: z.string().trim().min(1, 'Employee ID is required').max(32),
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  phone: z.string().trim().max(40).optional(),
  hire_date: z.string().trim().optional(),
  seniority_number: z.number().int().nonnegative().optional(),
  department: z.string().trim().max(80).optional(),
  role: roleEnum,
  shift: z.string().trim().max(40).optional(),
  pto_balance: balance.optional(),
  vacation_balance: balance.optional(),
  fmla_balance: balance.optional(),
})

export const InviteEmployeeSchema = CreateEmployeeSchema.omit({ password: true })

// .strict() rejects unknown keys → prevents mass-assignment when this validated
// object is used directly in an UPDATE.
export const UpdateEmployeeSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    hire_date: z.string().trim().nullable().optional(),
    seniority_number: z.number().int().nonnegative().nullable().optional(),
    department: z.string().trim().max(80).nullable().optional(),
    role: roleEnum.optional(),
    status: statusEnum.optional(),
    shift: z.string().trim().max(40).nullable().optional(),
    pto_balance: balance.optional(),
    vacation_balance: balance.optional(),
    fmla_balance: balance.optional(),
  })
  .strict()
