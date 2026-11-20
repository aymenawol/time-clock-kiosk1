import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { serverEnv } from "@/lib/server-env";
import { createClient } from "@/lib/supabase/server";

/** Parsed PLATFORM_ADMIN_EMAILS (lower-cased). Empty when unset: nobody is an operator. */
export function platformEmails(): string[] {
  return (serverEnv().PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return platformEmails().includes(email.trim().toLowerCase());
}

export interface PlatformOperator {
  userId: string;
  email: string;
}

/**
 * The signed-in platform operator, or null. Checked against the verified Auth
 * user (auth.getUser() hits the Auth server) on every request, never the client.
 * Needs no employees row.
 */
export const getPlatformOperator = cache(async (): Promise<PlatformOperator | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email || !isPlatformEmail(user.email)) return null;
  return { userId: user.id, email: user.email.toLowerCase() };
});

/** Guard for /platform pages and actions. The proxy already sends anonymous users to /login; everyone else who is not an operator gets a 404. */
export async function requirePlatformOperator(): Promise<PlatformOperator> {
  const operator = await getPlatformOperator();
  if (!operator) notFound();
  return operator;
}
