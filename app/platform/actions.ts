"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { friendlyError, type ActionResult } from "@/lib/actions";
import { getPlatformOperator } from "@/lib/auth/platform";
import { publicEnv } from "@/lib/env";
import { seedOrgReferenceData } from "@/lib/org-defaults";
import { SLUG_PATTERN, US_TIME_ZONES } from "@/lib/platform-config";
import { orgSettingsSchema } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  name: z.string().trim().min(2, "Enter the company name").max(120),
  slug: z.string().trim().toLowerCase().regex(SLUG_PATTERN, "Slug: 2 to 49 lowercase letters, numbers and hyphens"),
  timezone: z.enum(US_TIME_ZONES.map((z) => z.value) as [string, ...string[]], "Choose a time zone"),
  firstName: z.string().trim().min(1, "Enter the admin's first name").max(80),
  lastName: z.string().trim().min(1, "Enter the admin's last name").max(80),
  email: z.email("Enter a valid email").max(200).transform((v) => v.toLowerCase()),
  employeeNumber: z.string().trim().regex(/^[0-9]{3,8}$/, "Employee number is 3 to 8 digits"),
});

export type CreateCompanyInput = z.input<typeof schema>;
export interface CreatedCompany {
  orgId: string;
  name: string;
  slug: string;
  adminFirstName: string;
  adminEmail: string;
}

async function siteOrigin(): Promise<string> {
  if (publicEnv.NEXT_PUBLIC_SITE_URL) return publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Create a customer company and its first admin. Platform operators only. */
export async function createCompany(raw: CreateCompanyInput): Promise<ActionResult<CreatedCompany>> {
  // Re-checked on every call against the verified Auth user.
  const operator = await getPlatformOperator();
  if (!operator) return { ok: false, error: "You don't have permission to do that." };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) (fieldErrors[issue.path.join(".") || "_"] ??= []).push(issue.message);
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form.", fieldErrors };
  }
  const v = parsed.data;
  const admin = createAdminClient();

  let orgId: string | null = null;
  let userId: string | null = null;
  // Deleting the org cascades to employees and reference data; the Auth user is separate.
  const rollback = async () => {
    if (orgId) await admin.from("organizations").delete().eq("id", orgId);
    if (userId) await admin.auth.admin.deleteUser(userId);
  };
  try {
    const { data: taken } = await admin.from("organizations").select("id").eq("slug", v.slug).maybeSingle();
    if (taken) return { ok: false, error: "That slug is already taken.", fieldErrors: { slug: ["That slug is already taken."] } };

    const org = await admin
      .from("organizations")
      .insert({ name: v.name, slug: v.slug, timezone: v.timezone, settings: orgSettingsSchema.parse({}) })
      .select("id")
      .single();
    if (org.error) throw org.error;
    orgId = org.data.id;

    const invite = await admin.auth.admin.inviteUserByEmail(v.email, {
      redirectTo: `${await siteOrigin()}/auth/callback`,
      data: { name: `${v.firstName} ${v.lastName}`, must_change_password: true },
    });
    if (invite.error || !invite.data.user) {
      await rollback();
      const exists = invite.error?.code === "email_exists" || /already|registered/i.test(invite.error?.message ?? "");
      return {
        ok: false,
        error: exists
          ? "A login with that email already exists. Use a different email."
          : "The invite email could not be sent. Check the email address and try again.",
        fieldErrors: exists ? { email: ["A login with that email already exists."] } : undefined,
      };
    }
    userId = invite.data.user.id;

    const emp = await admin
      .from("employees")
      .insert({
        organization_id: orgId,
        user_id: userId,
        employee_number: v.employeeNumber,
        first_name: v.firstName,
        last_name: v.lastName,
        email: v.email,
        role: "admin",
        job_title: "Admin",
      })
      .select("id")
      .single();
    if (emp.error) throw emp.error;

    await seedOrgReferenceData(admin, orgId);

    const { error: auditError } = await admin.from("audit_events").insert({
      organization_id: orgId,
      actor_employee_id: null,
      actor_user_id: operator.userId,
      action: "organization.create",
      entity: "organizations",
      entity_id: orgId,
      data: { operator: operator.email, slug: v.slug, admin_email: v.email, admin_employee_id: emp.data.id },
    });
    if (auditError) console.error("[audit]", auditError);

    return { ok: true, data: { orgId, name: v.name, slug: v.slug, adminFirstName: v.firstName, adminEmail: v.email } };
  } catch (err) {
    console.error("[platform.createCompany]", err);
    await rollback();
    return { ok: false, error: friendlyError(err) };
  }
}
