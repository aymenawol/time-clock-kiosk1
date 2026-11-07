import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Invite and password-recovery links land here. Supports both the PKCE `code`
 * flow and the `token_hash` flow, then sends the user to set a password.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  const dest = url.clone();
  dest.search = "";
  if (!ok) {
    dest.pathname = "/login";
    return NextResponse.redirect(dest);
  }
  dest.pathname = type === "invite" || type === "recovery" || !type ? "/auth/set-password" : "/";
  return NextResponse.redirect(dest);
}
