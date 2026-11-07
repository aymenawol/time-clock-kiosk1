"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuth, ORG_COOKIE } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export async function switchOrganization(organizationId: string) {
  const id = z.uuid().parse(organizationId);
  const auth = await getAuth();
  if (!auth || auth === "no-membership") redirect("/login");
  const membership = auth.memberships.find((m) => m.organization_id === id);
  if (!membership) return;
  (await cookies()).set(ORG_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect(homeFor(membership.role));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
