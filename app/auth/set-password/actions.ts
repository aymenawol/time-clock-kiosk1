"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type SetPasswordState = { error?: string } | undefined;

const schema = z
  .object({
    password: z.string().min(10, "Use at least 10 characters").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The passwords do not match", path: ["confirm"] });

export async function setPassword(_prev: SetPasswordState, form: FormData): Promise<SetPasswordState> {
  const parsed = schema.safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
    data: { must_change_password: false },
  });
  if (error) {
    return { error: error.code === "same_password" ? "Choose a password you have not used here before." : "Could not save the password. Try again." };
  }
  redirect("/");
}
