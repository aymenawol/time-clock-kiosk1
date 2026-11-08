"use server";

import { z } from "zod";
import { action, ActionError, audit, check, zId, zOptionalText } from "@/lib/actions";
import type { AuthContext } from "@/lib/auth/session";
import { ROLES } from "@/lib/auth/permissions";
import { LEAVE_KINDS } from "@/lib/forms";
import { weakPinReason } from "@/lib/pin";
import { createAdminClient } from "@/lib/supabase/admin";

const bool = z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")]);
const optDate = z
  .union([z.literal(""), z.iso.date("Enter a valid date")])
  .optional()
  .transform((v) => v || null);
const optInt = z
  .union([z.literal(""), z.coerce.number().int("Use a whole number").min(1).max(100000)])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));
const optEmail = z
  .union([z.literal(""), z.email("Enter a valid email")])
  .optional()
  .transform((v) => (v ? v.toLowerCase() : null));
const employeeNumber = z.string().trim().regex(/^\d{3,8}$/, "Employee number must be 3 to 8 digits");
const dollars = z.coerce.number().min(0, "Pay rate cannot be negative").max(1000, "Check the pay rate");
const password = z.string().min(10, "Use at least 10 characters").max(72, "Use at most 72 characters");
const name = (label: string) => z.string().trim().min(1, `${label} is required`).max(80);

const profileFields = {
  employee_number: employeeNumber,
  first_name: name("First name"),
  last_name: name("Last name"),
  email: optEmail,
  phone: zOptionalText(40),
  job_title: zOptionalText(80),
  hire_date: optDate,
  seniority_number: optInt,
  notes: zOptionalText(2000),
};

async function loadEmployee(ctx: AuthContext, id: string) {
  const { data } = await ctx.supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();
  if (!data) throw new ActionError("Employee not found.");
  return data;
}

/** Other organizations this login still belongs to (the Auth user is shared across them). */
async function otherMemberships(userId: string, exceptEmployeeId: string) {
  const { count } = await createAdminClient()
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("id", exceptEmployeeId)
    .neq("status", "terminated");
  return count ?? 0;
}

function authMessage(err: { message?: string; code?: string } | null): string {
  const msg = err?.message?.toLowerCase() ?? "";
  if (msg.includes("already") || err?.code === "email_exists") return "A login with that email already exists.";
  if (msg.includes("password")) return "That password was rejected. Use a longer, less common password.";
  return "The login could not be created. Please try again.";
}

// ---------------------------------------------------------------------------

export const createEmployee = action(
  {
    schema: z
      .object({
        ...profileFields,
        role: z.enum(ROLES),
        pay_rate: dollars,
        daily_ot_exempt: bool.default(false),
        ot_exempt_reason: zOptionalText(500),
        pin: z.string().trim(),
        create_login: bool.default(false),
        temp_password: z.string().optional(),
      })
      .superRefine((v, ctx) => {
        const weak = weakPinReason(v.pin, v.employee_number);
        if (weak) ctx.addIssue({ code: "custom", path: ["pin"], message: weak });
        if (v.daily_ot_exempt && !v.ot_exempt_reason) {
          ctx.addIssue({ code: "custom", path: ["ot_exempt_reason"], message: "Give the reason for the exemption" });
        }
        if (v.create_login) {
          if (!v.email) ctx.addIssue({ code: "custom", path: ["email"], message: "An email is needed to create a login" });
          if (!password.safeParse(v.temp_password ?? "").success) {
            ctx.addIssue({ code: "custom", path: ["temp_password"], message: "Use a temporary password of at least 10 characters" });
          }
        }
      }),
    capability: "peopleEdit",
  },
  async (v, ctx) => {
    const { data: dup } = await ctx.supabase
      .from("employees")
      .select("id")
      .eq("organization_id", ctx.org.id)
      .eq("employee_number", v.employee_number)
      .maybeSingle();
    if (dup) throw new ActionError(`Employee number ${v.employee_number} is already in use.`);

    const admin = createAdminClient();
    let userId: string | null = null;
    if (v.create_login && v.email) {
      const { data, error } = await admin.auth.admin.createUser({
        email: v.email,
        password: v.temp_password!,
        email_confirm: true,
        user_metadata: { must_change_password: true },
      });
      if (error || !data.user) throw new ActionError(authMessage(error));
      userId = data.user.id;
    }

    const { data: created, error } = await ctx.supabase
      .from("employees")
      .insert({
        organization_id: ctx.org.id,
        user_id: userId,
        employee_number: v.employee_number,
        first_name: v.first_name,
        last_name: v.last_name,
        email: v.email,
        phone: v.phone,
        role: v.role,
        job_title: v.job_title,
        hire_date: v.hire_date,
        seniority_number: v.seniority_number,
        notes: v.notes,
      })
      .select("id")
      .single();
    if (error || !created) {
      if (userId) await admin.auth.admin.deleteUser(userId);
      throw error ?? new ActionError("The employee could not be created.");
    }

    check(
      await ctx.supabase
        .from("employee_compensation")
        .update({
          pay_rate_cents: Math.round(v.pay_rate * 100),
          daily_ot_exempt: v.daily_ot_exempt,
          ot_exempt_reason: v.daily_ot_exempt ? v.ot_exempt_reason : null,
        })
        .eq("employee_id", created.id)
        .eq("organization_id", ctx.org.id),
    );
    check(await ctx.supabase.rpc("set_employee_pin", { p_employee_id: created.id, p_pin: v.pin }));
    await audit(ctx, "employee.create", "employees", created.id, {
      employee_number: v.employee_number,
      role: v.role,
      login: Boolean(userId),
    });
    return { id: created.id };
  },
);

export const updateProfile = action(
  { schema: z.object({ id: zId, ...profileFields }), capability: "peopleEdit" },
  async ({ id, ...v }, ctx) => {
    const current = await loadEmployee(ctx, id);
    if (v.employee_number !== current.employee_number) {
      const { data: dup } = await ctx.supabase
        .from("employees")
        .select("id")
        .eq("organization_id", ctx.org.id)
        .eq("employee_number", v.employee_number)
        .neq("id", id)
        .maybeSingle();
      if (dup) throw new ActionError(`Employee number ${v.employee_number} is already in use.`);
    }
    check(await ctx.supabase.from("employees").update(v).eq("id", id).eq("organization_id", ctx.org.id));
    await audit(ctx, "employee.update", "employees", id, { fields: Object.keys(v) });
  },
);

export const changeRole = action(
  { schema: z.object({ id: zId, role: z.enum(ROLES) }), capability: "peopleEdit" },
  async ({ id, role }, ctx) => {
    const current = await loadEmployee(ctx, id);
    if (current.role === role) return;
    check(await ctx.supabase.from("employees").update({ role }).eq("id", id).eq("organization_id", ctx.org.id));
    await audit(ctx, "employee.role", "employees", id, { from: current.role, to: role });
  },
);

export const setStatus = action(
  { schema: z.object({ id: zId, status: z.enum(["active", "on_leave", "terminated"]) }), capability: "peopleEdit" },
  async ({ id, status }, ctx) => {
    const current = await loadEmployee(ctx, id);
    if (current.status === status) return;
    if (status === "terminated") {
      if (current.id === ctx.employee.id) throw new ActionError("You cannot end your own employment.");
      const { data: open } = await ctx.supabase
        .from("shifts")
        .select("id")
        .eq("employee_id", id)
        .eq("status", "active")
        .limit(1);
      if (open?.length) throw new ActionError("This employee is still clocked in. Clock them out first.");
    }
    check(await ctx.supabase.from("employees").update({ status }).eq("id", id).eq("organization_id", ctx.org.id));

    if (current.user_id) {
      const admin = createAdminClient();
      if (status === "terminated") {
        // The Auth user is shared by every organization the person belongs to.
        if ((await otherMemberships(current.user_id, id)) === 0) {
          await admin.auth.admin.updateUserById(current.user_id, { ban_duration: "876000h" });
        }
      } else if (current.status === "terminated") {
        await admin.auth.admin.updateUserById(current.user_id, { ban_duration: "none" });
      }
    }
    await audit(ctx, "employee.status", "employees", id, { from: current.status, to: status });
  },
);

export const saveCompensation = action(
  {
    schema: z
      .object({
        id: zId,
        pay_rate: dollars,
        daily_ot_exempt: bool,
        ot_exempt_reason: zOptionalText(500),
      })
      .refine((v) => !v.daily_ot_exempt || v.ot_exempt_reason, {
        message: "Give the reason for the exemption",
        path: ["ot_exempt_reason"],
      }),
    capability: "peopleEdit",
  },
  async (v, ctx) => {
    await loadEmployee(ctx, v.id);
    check(
      await ctx.supabase
        .from("employee_compensation")
        .update({
          pay_rate_cents: Math.round(v.pay_rate * 100),
          daily_ot_exempt: v.daily_ot_exempt,
          ot_exempt_reason: v.daily_ot_exempt ? v.ot_exempt_reason : null,
        })
        .eq("employee_id", v.id)
        .eq("organization_id", ctx.org.id),
    );
    await audit(ctx, "employee.compensation", "employees", v.id, {
      pay_rate_cents: Math.round(v.pay_rate * 100),
      daily_ot_exempt: v.daily_ot_exempt,
      reason: v.daily_ot_exempt ? v.ot_exempt_reason : null,
    });
  },
);

export const setPin = action(
  { schema: z.object({ id: zId, pin: z.string().trim() }), capability: "peopleEdit" },
  async ({ id, pin }, ctx) => {
    const current = await loadEmployee(ctx, id);
    const weak = weakPinReason(pin, current.employee_number);
    if (weak) throw new ActionError(weak);
    check(await ctx.supabase.rpc("set_employee_pin", { p_employee_id: id, p_pin: pin }));
    await audit(ctx, "employee.pin_set", "employees", id);
  },
);

export const unlockPin = action(
  { schema: z.object({ id: zId }), capability: "peopleEdit" },
  async ({ id }, ctx) => {
    await loadEmployee(ctx, id);
    check(
      await createAdminClient()
        .from("employee_credentials")
        .update({ failed_count: 0, locked_until: null })
        .eq("employee_id", id)
        .eq("organization_id", ctx.org.id),
    );
    await audit(ctx, "employee.pin_unlock", "employees", id);
  },
);

export const createLogin = action(
  { schema: z.object({ id: zId, password }), capability: "peopleEdit" },
  async ({ id, password: pw }, ctx) => {
    const current = await loadEmployee(ctx, id);
    if (current.user_id) throw new ActionError("This employee already has a login.");
    if (!current.email) throw new ActionError("Add an email address to the profile first.");
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: current.email,
      password: pw,
      email_confirm: true,
      user_metadata: { must_change_password: true },
    });
    if (error || !data.user) throw new ActionError(authMessage(error));
    const { error: linkError } = await ctx.supabase
      .from("employees")
      .update({ user_id: data.user.id })
      .eq("id", id)
      .eq("organization_id", ctx.org.id);
    if (linkError) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw linkError;
    }
    await audit(ctx, "employee.login_create", "employees", id);
  },
);

export const resetPassword = action(
  { schema: z.object({ id: zId, password }), capability: "peopleEdit" },
  async ({ id, password: pw }, ctx) => {
    const current = await loadEmployee(ctx, id);
    if (!current.user_id) throw new ActionError("This employee has no login.");
    const { error } = await createAdminClient().auth.admin.updateUserById(current.user_id, {
      password: pw,
      user_metadata: { must_change_password: true },
    });
    if (error) throw new ActionError(authMessage(error));
    await audit(ctx, "employee.password_reset", "employees", id);
  },
);

export const removeLogin = action(
  { schema: z.object({ id: zId }), capability: "peopleEdit" },
  async ({ id }, ctx) => {
    const current = await loadEmployee(ctx, id);
    if (!current.user_id) throw new ActionError("This employee has no login.");
    if (current.id === ctx.employee.id) throw new ActionError("You cannot remove your own login.");
    const userId = current.user_id;
    check(await ctx.supabase.from("employees").update({ user_id: null }).eq("id", id).eq("organization_id", ctx.org.id));
    // Only delete the Auth user when no other organization uses it.
    if ((await otherMemberships(userId, id)) === 0) await createAdminClient().auth.admin.deleteUser(userId);
    await audit(ctx, "employee.login_remove", "employees", id);
  },
);

export const adjustLeave = action(
  {
    schema: z.object({
      id: zId,
      kind: z.enum(LEAVE_KINDS),
      hours: z.coerce
        .number()
        .refine((n) => n !== 0, "Enter the hours to add or remove")
        .refine((n) => Math.abs(n) <= 2000, "That is too many hours"),
      reason: z.string().trim().min(3, "Give a reason").max(500),
    }),
    capability: "peopleEdit",
  },
  async (v, ctx) => {
    await loadEmployee(ctx, v.id);
    check(
      await ctx.supabase.from("leave_ledger").insert({
        organization_id: ctx.org.id,
        employee_id: v.id,
        kind: v.kind,
        hours: v.hours,
        reason: v.reason,
        created_by: ctx.employee.id,
      }),
    );
    await audit(ctx, "employee.leave_adjust", "employees", v.id, { kind: v.kind, hours: v.hours, reason: v.reason });
  },
);
