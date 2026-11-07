import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { readSettings, type OrgSettings } from "@/lib/settings";
import { createClient, type ServerClient } from "@/lib/supabase/server";
import type { Employee, Organization } from "@/lib/supabase/types";
import { can, homeFor, type Capability } from "./permissions";

export const ORG_COOKIE = "rc_org";

export interface Membership extends Employee {
  organization: Organization;
}

export interface AuthContext {
  supabase: ServerClient;
  userId: string;
  email: string | null;
  /** The caller's employee row in the active organization. */
  employee: Employee;
  org: Organization;
  settings: OrgSettings;
  memberships: Membership[];
}

/**
 * The signed-in user and their memberships, resolved once per request.
 * Membership and role come from the database (employees), never from the JWT,
 * so a role change or termination takes effect on the next request.
 */
export const getAuth = cache(async (): Promise<AuthContext | null | "no-membership"> => {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data: rows } = await supabase
    .from("employees")
    .select("*, organization:organizations(*)")
    .eq("user_id", user.id)
    .neq("status", "terminated")
    .order("created_at");
  const memberships = (rows ?? []).filter((m): m is Membership => Boolean(m.organization));
  if (memberships.length === 0) return "no-membership";

  const preferred = (await cookies()).get(ORG_COOKIE)?.value;
  const active = memberships.find((m) => m.organization_id === preferred) ?? memberships[0];
  const { organization, ...employee } = active;
  return {
    supabase,
    userId: user.id,
    email: user.email ?? null,
    employee,
    org: organization,
    settings: readSettings(organization.settings),
    memberships,
  };
});

/**
 * Guard for layouts, pages and server actions. Redirects anonymous users to
 * /login, users without a membership to /auth/no-access, and users without the
 * capability to their own home page.
 */
export async function requireAuth(capability?: Capability): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  if (auth === "no-membership") redirect("/auth/no-access");
  if (capability && !can(auth.employee.role, capability)) redirect(`${homeFor(auth.employee.role)}?denied=1`);
  return auth;
}
