"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { setPassword, type SetPasswordState } from "./actions";

export function SetPasswordForm() {
  const [state, formAction, pending] = useActionState<SetPasswordState, FormData>(setPassword, undefined);
  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <Field label="New password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Field label="Confirm password" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      {state?.error ? (
        <p role="alert" className="rounded-[var(--radius-control)] bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" loading={pending}>
        Save password
      </Button>
    </form>
  );
}
