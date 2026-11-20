"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { homeFor } from "@/lib/auth/permissions";
import { isPlatformEmail } from "@/lib/auth/platform";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.email("Enter a valid email").max(200),
  password: z.string().min(1, "Enter your password").max(200),
  next: z.string().optional(),
});

export type LoginState = { error?: string } | undefined;

/** Only same-site relative paths are allowed after sign-in. */
function safeNext(next: string | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (next.startsWith("/login") || next.startsWith("/auth")) return null;
  return next;
}

export async function signIn(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    next: form.get("next") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email.toLowerCase(),
    password: parsed.data.password,
  });
  if (error || !data.user) {
    // Same message for unknown email and wrong password.
    return { error: error?.status === 429 ? "Too many attempts. Wait a minute and try again." : "Email or password is incorrect." };
  }

  const { data: membership } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", data.user.id)
    .neq("status", "terminated")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  // A platform operator may have no employees row; they land on /platform.
  const operator = isPlatformEmail(data.user.email);
  if (!membership && !operator) {
    await supabase.auth.signOut();
    return { error: "Your account is not active in any organization. Contact your admin." };
  }
  if (data.user.user_metadata?.must_change_password) redirect("/auth/set-password");
  const home = membership ? homeFor(membership.role) : "/platform";
  redirect(safeNext(parsed.data.next) ?? home);
}
