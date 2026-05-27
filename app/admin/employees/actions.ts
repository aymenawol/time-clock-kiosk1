"use server"

import { revalidatePath } from "next/cache"
import { createSupabaseAdmin } from "@/lib/supabase-admin"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import type { EmployeeRole, EmployeeStatus } from "@/lib/supabase"

// ── Shared role guard ────────────────────────────────────────────────────────

async function requireAdminRole() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthenticated")
  const role = user.app_metadata?.role as string | undefined
  if (role !== "admin" && role !== "management") throw new Error("Forbidden")
  return user
}

// ── Types ────────────────────────────────────────────────────────────────────

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

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

// ── Create Employee ──────────────────────────────────────────────────────────

export async function createEmployeeAction(
  input: CreateEmployeeInput
): Promise<ActionResult<{ id: string; auth_user_id: string }>> {
  try {
    await requireAdminRole()
  } catch (e: any) {
    return { success: false, error: e.message }
  }

  const admin = createSupabaseAdmin()

  // 1. Create the Supabase Auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true, // skip email confirmation for internal accounts
    app_metadata: { role: input.role },
    user_metadata: { name: input.name, employee_id: input.employee_id },
  })

  if (authError || !authData.user) {
    return { success: false, error: authError?.message ?? "Failed to create auth user" }
  }

  const authUserId = authData.user.id

  // 2. Insert the employee row (linked to the auth user)
  const { data: emp, error: empError } = await admin
    .from("employees")
    .insert({
      employee_id: input.employee_id,
      name: input.name,
      pin: "", // deprecated in v2; empty placeholder
      is_active: true,
      auth_user_id: authUserId,
      email: input.email,
      phone: input.phone ?? null,
      hire_date: input.hire_date ?? null,
      seniority_number: input.seniority_number ?? null,
      department: input.department ?? null,
      role: input.role,
      status: "active",
      shift: input.shift ?? null,
      pto_balance: input.pto_balance ?? 0,
      vacation_balance: input.vacation_balance ?? 0,
      fmla_balance: input.fmla_balance ?? 0,
    })
    .select("id")
    .single()

  if (empError || !emp) {
    // Rollback: delete the auth user we just created
    await admin.auth.admin.deleteUser(authUserId)
    return { success: false, error: empError?.message ?? "Failed to create employee record" }
  }

  // 3. Create the profile row
  const { error: profileError } = await admin.from("profiles").insert({
    id: authUserId,
    employee_id: input.employee_id,
    role: input.role,
    is_active: true,
  })

  if (profileError) {
    // Non-fatal: log but don't roll back — the employee row is the source of truth
    console.error("Profile insert failed:", profileError.message)
  }

  revalidatePath("/admin/employees")
  return { success: true, data: { id: emp.id, auth_user_id: authUserId } }
}

// ── Invite Employee ──────────────────────────────────────────────────────────

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

export async function inviteEmployeeAction(
  input: InviteEmployeeInput
): Promise<ActionResult<{ id: string; auth_user_id: string; invited: true }>> {
  try {
    await requireAdminRole()
  } catch (e: any) {
    return { success: false, error: e.message }
  }

  const admin = createSupabaseAdmin()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ""

  // 1. Send invite email — Supabase sends the magic link, user sets password on /onboard
  const { data: authData, error: authError } = await admin.auth.admin.inviteUserByEmail(
    input.email,
    {
      redirectTo: `${siteUrl}/auth/callback`,
      data: { name: input.name, employee_id: input.employee_id },
    }
  )

  if (authError || !authData.user) {
    return { success: false, error: authError?.message ?? "Failed to send invite email" }
  }

  const authUserId = authData.user.id

  // 2. Set role in app_metadata (inviteUserByEmail doesn't accept app_metadata directly)
  await admin.auth.admin.updateUserById(authUserId, {
    app_metadata: { role: input.role },
  })

  // 3. Insert the employee row
  const { data: emp, error: empError } = await admin
    .from("employees")
    .insert({
      employee_id: input.employee_id,
      name: input.name,
      pin: "",
      is_active: true,
      auth_user_id: authUserId,
      email: input.email,
      phone: input.phone ?? null,
      hire_date: input.hire_date ?? null,
      seniority_number: input.seniority_number ?? null,
      department: input.department ?? null,
      role: input.role,
      status: "active",
      shift: input.shift ?? null,
      pto_balance: input.pto_balance ?? 0,
      vacation_balance: input.vacation_balance ?? 0,
      fmla_balance: input.fmla_balance ?? 0,
    })
    .select("id")
    .single()

  if (empError || !emp) {
    await admin.auth.admin.deleteUser(authUserId)
    return { success: false, error: empError?.message ?? "Failed to create employee record" }
  }

  // 4. Create profile row
  const { error: profileError } = await admin.from("profiles").insert({
    id: authUserId,
    employee_id: input.employee_id,
    role: input.role,
    is_active: true,
  })

  if (profileError) {
    console.error("Profile insert failed:", profileError.message)
  }

  revalidatePath("/admin/employees")
  return { success: true, data: { id: emp.id, auth_user_id: authUserId, invited: true } }
}

// ── Update Employee ──────────────────────────────────────────────────────────

export async function updateEmployeeAction(
  employeeId: string,
  input: UpdateEmployeeInput
): Promise<ActionResult> {
  try {
    await requireAdminRole()
  } catch (e: any) {
    return { success: false, error: e.message }
  }

  const admin = createSupabaseAdmin()

  // Fetch current record to get auth_user_id
  const { data: existing, error: fetchError } = await admin
    .from("employees")
    .select("auth_user_id, role")
    .eq("id", employeeId)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: "Employee not found" }
  }

  // Update the employees table
  const { error: updateError } = await admin
    .from("employees")
    .update({
      ...input,
      is_active: input.status !== "terminated",
    })
    .eq("id", employeeId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // If role changed, sync it to auth user's app_metadata and profiles table
  if (input.role && input.role !== existing.role && existing.auth_user_id) {
    await admin.auth.admin.updateUserById(existing.auth_user_id, {
      app_metadata: { role: input.role },
    })
    await admin
      .from("profiles")
      .update({ role: input.role })
      .eq("id", existing.auth_user_id)
  }

  // If status changed to terminated, ban the auth account (blocks login)
  if (input.status && existing.auth_user_id) {
    const banned = input.status === "terminated"
    await admin.auth.admin.updateUserById(existing.auth_user_id, {
      ban_duration: banned ? "876600h" : "none", // ~100 years = effectively banned
    })
    await admin
      .from("profiles")
      .update({ is_active: !banned })
      .eq("id", existing.auth_user_id)
  }

  revalidatePath("/admin/employees")
  return { success: true, data: undefined }
}

// ── Toggle Employee Active/Inactive ─────────────────────────────────────────

export async function toggleEmployeeStatusAction(
  employeeId: string,
  newStatus: "active" | "terminated"
): Promise<ActionResult> {
  return updateEmployeeAction(employeeId, { status: newStatus })
}

// ── Reset Employee Password ──────────────────────────────────────────────────

export async function resetEmployeePasswordAction(
  employeeId: string,
  newPassword: string
): Promise<ActionResult> {
  try {
    await requireAdminRole()
  } catch (e: any) {
    return { success: false, error: e.message }
  }

  const admin = createSupabaseAdmin()

  const { data: emp, error: fetchError } = await admin
    .from("employees")
    .select("auth_user_id")
    .eq("id", employeeId)
    .single()

  if (fetchError || !emp?.auth_user_id) {
    return { success: false, error: "Employee not found or has no auth account" }
  }

  const { error } = await admin.auth.admin.updateUserById(emp.auth_user_id, {
    password: newPassword,
  })

  if (error) return { success: false, error: error.message }
  return { success: true, data: undefined }
}

// ── Get All Employees (server-side, bypasses RLS) ────────────────────────────

export async function getAllEmployeesAction() {
  try {
    await requireAdminRole()
  } catch (e: any) {
    return { success: false as const, error: e.message }
  }

  const admin = createSupabaseAdmin()

  const { data, error } = await admin
    .from("employees")
    .select("*")
    .order("seniority_number", { ascending: true, nullsFirst: false })
    .order("hire_date", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })

  if (error) return { success: false as const, error: error.message }
  return { success: true as const, data: data ?? [] }
}

// ── Export Employees CSV ─────────────────────────────────────────────────────

export async function exportEmployeesCSVAction(): Promise<ActionResult<string>> {
  try {
    await requireAdminRole()
  } catch (e: any) {
    return { success: false, error: e.message }
  }

  const result = await getAllEmployeesAction()
  if (!result.success) return { success: false, error: result.error }

  const employees = result.data
  const headers = [
    "Employee ID",
    "Name",
    "Role",
    "Department",
    "Status",
    "Shift",
    "Seniority #",
    "Hire Date",
    "Email",
    "Phone",
    "PTO Balance",
    "Vacation Balance",
    "FMLA Balance",
  ]

  const rows = employees.map((e) =>
    [
      e.employee_id,
      e.name,
      e.role ?? "",
      e.department ?? "",
      e.status,
      e.shift ?? "",
      e.seniority_number ?? "",
      e.hire_date ?? "",
      e.email ?? "",
      e.phone ?? "",
      e.pto_balance,
      e.vacation_balance,
      e.fmla_balance,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  )

  const csv = [headers.map((h) => `"${h}"`).join(","), ...rows].join("\n")
  return { success: true, data: csv }
}
