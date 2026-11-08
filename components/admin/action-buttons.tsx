"use client";

import { Trash2 } from "lucide-react";
import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useAction } from "@/components/ui/use-action";
import { ConfirmButton } from "./confirm-button";

type Result = { ok: true; data: unknown } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
type AnyAction = (input: never) => Promise<Result>;

const asRunnable = (fn: AnyAction) => fn as unknown as (input: unknown) => Promise<Result>;

/** Icon button that deletes a record after a confirmation. */
export function DeleteButton({
  action,
  input,
  what,
  description,
}: {
  action: AnyAction;
  input: Record<string, unknown>;
  /** e.g. "location LAS-T1" */
  what: string;
  description?: string;
}) {
  const [run] = useAction(asRunnable(action), { success: "Deleted" });
  return (
    <ConfirmButton
      size="icon-sm"
      variant="ghost"
      aria-label={`Delete ${what}`}
      title={`Delete ${what}?`}
      description={description ?? "This can't be undone. Mark it inactive instead if it may be needed again."}
      confirmLabel="Delete"
      confirmVariant="danger"
      onConfirm={() => run(input)}
    >
      <Trash2 aria-hidden className="text-danger" />
    </ConfirmButton>
  );
}

/** A button that runs one server action, optionally after a confirmation. */
export function ActionButton({
  action,
  input,
  success,
  confirm,
  children,
  ...props
}: Omit<ButtonProps, "onClick" | "action"> & {
  action: AnyAction;
  input: Record<string, unknown>;
  success?: string;
  confirm?: { title: string; description?: string; confirmLabel: string; danger?: boolean };
  children: React.ReactNode;
}) {
  const [run, pending] = useAction(asRunnable(action), { success });
  if (confirm) {
    return (
      <ConfirmButton
        {...props}
        title={confirm.title}
        description={confirm.description}
        confirmLabel={confirm.confirmLabel}
        confirmVariant={confirm.danger ? "danger" : "primary"}
        onConfirm={() => run(input)}
      >
        {children}
      </ConfirmButton>
    );
  }
  return (
    <Button type="button" {...props} loading={pending} onClick={() => run(input)}>
      {children}
    </Button>
  );
}
