import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/shell/brand";
import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Set your password" };

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Wordmark className="text-xl" />
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted">At least 10 characters. Avoid passwords you use elsewhere.</p>
        <SetPasswordForm />
      </div>
    </div>
  );
}
