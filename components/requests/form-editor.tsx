"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createForm, resubmitForm } from "@/app/m/forms/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { formSchemas, LEAVE_LABEL, type FormType, type LeaveKind } from "@/lib/forms";
import { ErrorNote } from "./back-header";

type FieldDef = {
  name: string;
  label: string;
  kind: "date" | "number" | "text" | "textarea" | "datetime" | "select";
  hint?: string;
  options?: { value: string; label: string }[];
  /** Only show when another field has this value. */
  showWhen?: { field: string; equals: string };
};

const FIELDS: Record<FormType, FieldDef[]> = {
  time_off: [
    {
      name: "leave_kind",
      label: "Leave type",
      kind: "select",
      options: (["pto", "vacation", "sick"] as const).map((v) => ({ value: v, label: LEAVE_LABEL[v] })),
    },
    { name: "start_date", label: "First day off", kind: "date" },
    { name: "end_date", label: "Last day off", kind: "date" },
    { name: "hours", label: "Total hours", kind: "number", hint: "For example 8 for one day." },
    { name: "reason", label: "Reason (optional)", kind: "textarea" },
  ],
  bid_vacation_change: [
    { name: "current", label: "Current line or dates", kind: "text" },
    { name: "requested", label: "What you want instead", kind: "text" },
    { name: "reason", label: "Why", kind: "textarea" },
  ],
  incident_report: [
    { name: "occurred_at", label: "When it happened", kind: "datetime" },
    { name: "location", label: "Where", kind: "text" },
    { name: "vehicle_number", label: "Vehicle number (optional)", kind: "text" },
    { name: "description", label: "What happened", kind: "textarea", hint: "At least 10 characters." },
    {
      name: "injuries",
      label: "Was anyone hurt?",
      kind: "select",
      options: [
        { value: "no", label: "No" },
        { value: "yes", label: "Yes" },
      ],
    },
    { name: "injury_details", label: "Injury details", kind: "textarea", showWhen: { field: "injuries", equals: "yes" } },
    { name: "witnesses", label: "Witnesses (optional)", kind: "textarea" },
    { name: "police_report", label: "Police report number (optional)", kind: "text" },
  ],
  fmla_conversion: [
    { name: "start_date", label: "First day", kind: "date" },
    { name: "end_date", label: "Last day", kind: "date" },
    { name: "hours", label: "Total hours", kind: "number" },
    { name: "reason", label: "Reason", kind: "textarea" },
  ],
  resignation: [
    { name: "last_day", label: "Your last day", kind: "date" },
    { name: "reason", label: "Reason (optional)", kind: "textarea" },
  ],
};

type Values = Record<string, string>;

function initialValues(type: FormType, payload?: Record<string, unknown>): Values {
  const v: Values = {};
  for (const f of FIELDS[type]) {
    const raw = payload?.[f.name];
    v[f.name] = raw !== undefined && raw !== null ? String(raw) : "";
  }
  if (type === "time_off" && !v.leave_kind) v.leave_kind = "pto";
  if (type === "incident_report" && !v.injuries) v.injuries = "no";
  return v;
}

export function FormEditor({
  type,
  balances,
  resubmitId,
  initialPayload,
}: {
  type: FormType;
  /** Leave balance hours per kind, for the time off form. */
  balances?: Record<string, number>;
  resubmitId?: string;
  initialPayload?: Record<string, unknown>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => initialValues(type, initialPayload));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [create, creating] = useAction(createForm, {
    success: "Request sent",
    onSuccess: (d) => router.push(`/m/forms/${d.id}`),
  });
  const [resubmit, resubmitting] = useAction(resubmitForm, {
    success: "Request sent again",
    onSuccess: () => router.push(`/m/forms/${resubmitId}`),
  });
  const pending = creating || resubmitting;

  function clean(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const f of FIELDS[type]) {
      if (f.showWhen && values[f.showWhen.field] !== f.showWhen.equals) continue;
      if (values[f.name].trim() !== "") out[f.name] = values[f.name].trim();
    }
    return out;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const payload = clean();
    const parsed = formSchemas[type].safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0] ?? "_")] ??= issue.message;
      setErrors(errs);
      setFormError("Check the highlighted fields.");
      return;
    }
    setErrors({});
    if (resubmitId) await resubmit({ id: resubmitId, payload });
    else await create({ type, payload });
  }

  const set = (name: string, value: string) => setValues((v) => ({ ...v, [name]: value }));
  const kind = values.leave_kind;
  const balance = type === "time_off" && balances ? (balances[kind] ?? 0) : null;
  const requested = Number(values.hours);

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {balance !== null ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface-2 p-3 text-sm">
          Your {LEAVE_LABEL[kind as LeaveKind] ?? kind} balance is <strong className="tabular">{balance.toFixed(2)} h</strong>.
          {requested > balance ? (
            <span className="mt-1 block text-warning">This is more than your balance. You can still send it.</span>
          ) : null}
        </div>
      ) : null}
      {FIELDS[type].map((f) => {
        if (f.showWhen && values[f.showWhen.field] !== f.showWhen.equals) return null;
        const id = `f-${f.name}`;
        const common = { id, name: f.name, value: values[f.name], "aria-invalid": errors[f.name] ? true : undefined };
        return (
          <Field key={f.name} label={f.label} htmlFor={id} hint={f.hint} error={errors[f.name]}>
            {f.kind === "textarea" ? (
              <Textarea {...common} onChange={(e) => set(f.name, e.target.value)} />
            ) : f.kind === "select" ? (
              <Select {...common} className="h-12" onChange={(e) => set(f.name, e.target.value)}>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                {...common}
                className="h-12 text-base"
                type={f.kind === "datetime" ? "datetime-local" : f.kind === "number" ? "number" : f.kind}
                inputMode={f.kind === "number" ? "decimal" : undefined}
                step={f.kind === "number" ? "0.25" : undefined}
                onChange={(e) => set(f.name, e.target.value)}
              />
            )}
          </Field>
        );
      })}
      {formError ? <ErrorNote>{formError}</ErrorNote> : null}
      <Button type="submit" size="xl" className="w-full" loading={pending}>
        {resubmitId ? "Send again" : "Send request"}
      </Button>
    </form>
  );
}
