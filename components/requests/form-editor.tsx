"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createForm, resubmitForm } from "@/app/m/forms/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { formSchemas, INCIDENT_LABEL, INCIDENT_TYPES, LEAVE_LABEL, TIME_OFF_LABEL, TIME_OFF_TYPES, type FormType, type LeaveKind } from "@/lib/forms";
import { ErrorNote } from "./back-header";

type FieldDef = {
  name: string;
  label: string;
  kind: "date" | "number" | "text" | "textarea" | "select";
  rows?: number;
  hint?: string;
  options?: { value: string; label: string }[];
  /** Only show when another field has this value. */
  showWhen?: { field: string; equals: string };
};

const yesNoOptions = (yes: string, no: string) => [
  { value: "", label: "-" },
  { value: "yes", label: yes },
  { value: "no", label: no },
];

// Field order and labels follow the v0 forms.
const FIELDS: Record<FormType, FieldDef[]> = {
  time_off: [
    { name: "start_date", label: "Start Date", kind: "date" },
    { name: "end_date", label: "End Date", kind: "date" },
    {
      name: "leave_type",
      label: "Type",
      kind: "select",
      options: TIME_OFF_TYPES.map((v) => ({ value: v, label: TIME_OFF_LABEL[v] })),
    },
    { name: "comments", label: "Comments", kind: "textarea" },
  ],
  bid_vacation_change: [
    { name: "current_assignment", label: "Current Assignment / Shift", kind: "text" },
    { name: "requested_change", label: "Requested Change", kind: "text" },
    { name: "reason", label: "Reason", kind: "textarea" },
  ],
  incident_report: [
    { name: "incident_date", label: "Incident Date", kind: "date" },
    { name: "bus_number", label: "Bus Number", kind: "text" },
    { name: "location", label: "Location / Route", kind: "text" },
    {
      name: "incident_type",
      label: "Incident Type",
      kind: "select",
      options: INCIDENT_TYPES.map((v) => ({ value: v, label: INCIDENT_LABEL[v] })),
    },
    { name: "description", label: "Description of Incident", kind: "textarea", rows: 5 },
    { name: "witnesses", label: "Witnesses (if any)", kind: "textarea", rows: 2 },
    { name: "passenger_info", label: "Passenger Information (names / contact, if any)", kind: "textarea", rows: 2 },
    { name: "supervisor_contacted", label: "Supervisor Contacted?", kind: "select", options: yesNoOptions("Yes", "No") },
    { name: "injuries_damage", label: "Injuries / Damage Details", kind: "textarea" },
  ],
  fmla_conversion: [
    { name: "leave_start_date", label: "Leave Start Date", kind: "date" },
    { name: "estimated_return_date", label: "Estimated Return Date", kind: "date" },
    { name: "condition_description", label: "Condition / Reason (medical information stays confidential)", kind: "textarea" },
    { name: "provider_name", label: "Healthcare Provider Name", kind: "text" },
    {
      name: "vacation_pay_usage",
      label: "Apply paid vacation/PTO during leave?",
      kind: "select",
      options: yesNoOptions("Yes - use my vacation/PTO balance", "No - unpaid FMLA"),
    },
    { name: "hours_used", label: "Estimated Hours Used", kind: "number" },
  ],
  resignation: [
    { name: "last_day", label: "Last Day of Work", kind: "date" },
    { name: "reason", label: "Reason for Resignation (optional)", kind: "textarea" },
  ],
};

type Values = Record<string, string>;

function initialValues(type: FormType, payload?: Record<string, unknown>): Values {
  const v: Values = {};
  for (const f of FIELDS[type]) {
    const raw = payload?.[f.name];
    v[f.name] = raw !== undefined && raw !== null ? String(raw) : "";
  }
  if (type === "time_off" && !v.leave_type) v.leave_type = "vacation";
  if (type === "incident_report" && !v.incident_type) v.incident_type = "vehicle_collision";
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
  const kind = values.leave_type;
  const balance = type === "time_off" && balances && (kind === "pto" || kind === "vacation") ? (balances[kind] ?? 0) : null;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {balance !== null ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface-2 p-3 text-sm">
          Your {LEAVE_LABEL[kind as LeaveKind] ?? kind} balance is <strong className="tabular">{balance.toFixed(2)} h</strong>.
        </div>
      ) : null}
      {type === "resignation" ? (
        <div role="note" className="rounded-[var(--radius-card)] border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          By submitting this form you are initiating the resignation process. Upon approval your system access will be deactivated on your last day.
        </div>
      ) : null}
      {FIELDS[type].map((f) => {
        if (f.showWhen && values[f.showWhen.field] !== f.showWhen.equals) return null;
        const id = `f-${f.name}`;
        const common = { id, name: f.name, value: values[f.name], "aria-invalid": errors[f.name] ? true : undefined };
        return (
          <Field key={f.name} label={f.label} htmlFor={id} hint={f.hint} error={errors[f.name]}>
            {f.kind === "textarea" ? (
              <Textarea {...common} rows={f.rows ?? 3} onChange={(e) => set(f.name, e.target.value)} />
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
                type={f.kind}
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
