"use server"

import { revalidatePath } from "next/cache"
import { createSupabaseAdmin } from "@/lib/supabase-admin"
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase-server"
import type { Employee, EmployeeRole, EmployeeStatus } from "@/lib/supabase"
import { type ActionResult, ok, fail, failValidation } from "@/lib/actions/result"
import { CreateEmployeeSchema, InviteEmployeeSchema, UpdateEmployeeSchema } from "@/lib/schemas/employee"
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  InviteEmployeeInput,
  EmployeeQuery,
  DirectoryEmployee,
  EmployeesPage,
  EmployeeSort,
} from "./types"
import { EMPLOYEES_PAGE_SIZE } from "./types"

// ── Shared role guard ────────────────────────────────────────────────────────

async function requireAdminRole() {
  const { user } = await getServerUser()
  if (!user) throw new Error("Unauthenticated")
  const role = user.app_metadata?.role as string | undefined
  if (role !== "admin" && role !== "management") throw new Error("Forbidden")
  return user
}

// ── Create Employee ──────────────────────────────────────────────────────────

export async function createEmployeeAction(
  input: CreateEmployeeInput
): Promise<ActionResult<{ id: string; auth_user_id: string }>> {
  try {
    await requireAdminRole()
  } catch (e: any) {
    return { success: false, error: e.message }
  }

  const parsed = CreateEmployeeSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)

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

export async function inviteEmployeeAction(
  input: InviteEmployeeInput
): Promise<ActionResult<{ id: string; auth_user_id: string; invited: true }>> {
  try {
    await requireAdminRole()
  } catch (e: any) {
    return { success: false, error: e.message }
  }

  const parsed = InviteEmployeeSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)

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

  const parsed = UpdateEmployeeSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const updates = parsed.data

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

  // Update the employees table — allow-listed fields only (no mass-assignment).
  // is_active is only touched when status is actually being changed.
  const { error: updateError } = await admin
    .from("employees")
    .update({
      ...updates,
      ...(updates.status ? { is_active: updates.status !== "terminated" } : {}),
    })
    .eq("id", employeeId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // If role changed, sync it to auth user's app_metadata and profiles table
  if (updates.role && updates.role !== existing.role && existing.auth_user_id) {
    await admin.auth.admin.updateUserById(existing.auth_user_id, {
      app_metadata: { role: updates.role },
    })
    await admin
      .from("profiles")
      .update({ role: updates.role })
      .eq("id", existing.auth_user_id)
  }

  // If status changed to terminated, ban the auth account (blocks login)
  if (updates.status && existing.auth_user_id) {
    const banned = updates.status === "terminated"
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

  // Projected to exactly the columns the CSV export consumes — avoids hauling
  // every employee column (incl. large/unused fields) for the full-roster read.
  const { data, error } = await admin
    .from("employees")
    .select(
      "id, employee_id, name, email, phone, department, shift, seniority_number, hire_date, role, status, pto_balance, vacation_balance, fmla_balance"
    )
    .order("seniority_number", { ascending: true, nullsFirst: false })
    .order("hire_date", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })

  if (error) return { success: false as const, error: error.message }
  return { success: true as const, data: data ?? [] }
}

// ── Get Employees Page (server-side pagination + projection + counts) ────────

/** Columns the directory table actually renders — projected to avoid `select('*')`. */
const DIRECTORY_COLUMNS =
  "id, employee_id, name, email, department, shift, seniority_number, hire_date, role, status, pto_balance, vacation_balance, fmla_balance"

export async function getEmployeesPageAction(
  query: EmployeeQuery = {}
): Promise<ActionResult<EmployeesPage>> {
  try {
    await requireAdminRole()
  } catch (e: any) {
    return fail(e.message)
  }

  const admin = createSupabaseAdmin()

  const page = Math.max(1, Math.floor(query.page ?? 1))
  const from = (page - 1) * EMPLOYEES_PAGE_SIZE
  const to = from + EMPLOYEES_PAGE_SIZE - 1

  let q = admin.from("employees").select(DIRECTORY_COLUMNS, { count: "exact" })

  // Free-text search across name / employee_id / email. Strip characters that
  // would break PostgREST's `or` grammar before interpolating.
  const term = (query.search ?? "").trim().replace(/[,()%*\\]/g, "")
  if (term) {
    q = q.or(`name.ilike.%${term}%,employee_id.ilike.%${term}%,email.ilike.%${term}%`)
  }
  if (query.role && query.role !== "all") q = q.eq("role", query.role)
  if (query.status && query.status !== "all") q = q.eq("status", query.status)

  // Default sort encodes the domain rule: seniority → hire date → name.
  if (query.sort === "name") {
    q = q.order("name", { ascending: true })
  } else if (query.sort === "hire_date") {
    q = q
      .order("hire_date", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })
  } else {
    q = q
      .order("seniority_number", { ascending: true, nullsFirst: false })
      .order("hire_date", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })
  }

  const { data, count, error } = await q.range(from, to)
  if (error) return fail(error.message)

  // Header stats — global (unaffected by the active filters). Bounded COUNT-only
  // queries (head: true → no rows transferred), one per status bucket.
  const countFor = (status?: string) => {
    let c = admin.from("employees").select("id", { count: "exact", head: true })
    if (status) c = c.eq("status", status)
    return c
  }
  const [tot, act, leave, term2] = await Promise.all([
    countFor(),
    countFor("active"),
    countFor("on_leave"),
    countFor("terminated"),
  ])

  return ok({
    employees: (data ?? []) as unknown as DirectoryEmployee[],
    total: count ?? 0,
    page,
    pageSize: EMPLOYEES_PAGE_SIZE,
    stats: {
      total: tot.count ?? 0,
      active: act.count ?? 0,
      onLeave: leave.count ?? 0,
      terminated: term2.count ?? 0,
    },
  })
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
