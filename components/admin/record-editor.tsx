"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";
import { WEEKDAYS } from "@/lib/scheduling/datetime";

export type FieldValue = string | number | boolean | null | string[] | number[];
export interface Option {
  value: string;
  label: string;
}

export type FieldDef = {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  /** Take the full row on wide screens. */
  wide?: boolean;
  placeholder?: string;
} & (
  | { type: "text" | "textarea" | "color" | "time" | "date" | "datetime"; maxLength?: number }
  | { type: "number"; min?: number; max?: number; step?: number }
  | { type: "checkbox" }
  | { type: "select"; options: Option[]; allowEmpty?: string }
  | { type: "multiselect"; options: Option[] }
  | { type: "ordered"; options: Option[] }
  | { type: "weekdays" }
);

type Result = { ok: true; data: unknown } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function emptyValue(f: FieldDef): FieldValue {
  switch (f.type) {
    case "checkbox":
      return false;
    case "multiselect":
    case "ordered":
      return [];
    case "weekdays":
      return [1, 2, 3, 4, 5];
    case "number":
      return null;
    default:
      return "";
  }
}

/**
 * A dialog form built from field definitions. Used for the admin catalogues
 * (locations, airlines, routes...) and bid lines. `action` receives the
 * values (plus `id` when editing) and is a server action defined with
 * `action()` from lib/actions.
 */
export function RecordEditor({
  title,
  description,
  fields,
  initial,
  id,
  extra,
  action,
  mode = "add",
  triggerLabel,
  submitLabel = "Save",
  disabled,
}: {
  title: string;
  description?: string;
  fields: FieldDef[];
  initial?: Record<string, FieldValue>;
  id?: string;
  /** Fixed values sent with every submit (e.g. the parent id). */
  extra?: Record<string, string>;
  action: (input: never) => Promise<Result>;
  mode?: "add" | "edit";
  triggerLabel?: string;
  submitLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const start = React.useCallback(
    () => Object.fromEntries(fields.map((f) => [f.name, initial?.[f.name] ?? emptyValue(f)])),
    [fields, initial],
  );
  const [values, setValues] = React.useState<Record<string, FieldValue>>(start);
  const [run, pending, fieldErrors] = useAction(action as unknown as (input: unknown) => Promise<Result>, {
    success: mode === "add" ? "Added" : "Saved",
    onSuccess: () => setOpen(false),
  });

  const set = (name: string, v: FieldValue) => setValues((prev) => ({ ...prev, [name]: v }));

  function onOpenChange(v: boolean) {
    if (v) setValues(start());
    setOpen(v);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await run({ ...(id ? { id } : {}), ...extra, ...values });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {mode === "add" ? (
        <Button type="button" size="sm" onClick={() => onOpenChange(true)} disabled={disabled}>
          <Plus aria-hidden />
          {triggerLabel ?? "Add"}
        </Button>
      ) : (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={() => onOpenChange(true)}
          disabled={disabled}
          aria-label={triggerLabel ?? "Edit"}
        >
          <Pencil aria-hidden />
        </Button>
      )}
      <DialogContent title={title} description={description} className="max-w-xl">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <FieldControl
                key={f.name}
                field={f}
                value={values[f.name]}
                onChange={(v) => set(f.name, v)}
                error={fieldErrors[f.name]?.[0]}
              />
            ))}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldControl({
  field: f,
  value,
  onChange,
  error,
}: {
  field: FieldDef;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  error?: string;
}) {
  const inputId = `rf-${f.name}`;
  const wide = f.wide || f.type === "textarea" || f.type === "ordered" || f.type === "multiselect" || f.type === "weekdays";
  const label = (
    <>
      {f.label}
      {f.required ? null : <span className="ml-1 font-normal text-muted">(optional)</span>}
    </>
  );

  if (f.type === "checkbox") {
    return (
      <div className={cn("flex items-start gap-2 sm:col-span-1", wide && "sm:col-span-2")}>
        <Checkbox id={inputId} checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="mt-0.5" />
        <div>
          <label htmlFor={inputId} className="text-sm font-medium text-fg">
            {f.label}
          </label>
          {f.hint ? <p className="text-xs text-muted">{f.hint}</p> : null}
        </div>
      </div>
    );
  }

  let control: React.ReactNode;
  switch (f.type) {
    case "textarea":
      control = (
        <Textarea
          id={inputId}
          value={String(value ?? "")}
          maxLength={f.maxLength}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error) || undefined}
        />
      );
      break;
    case "number":
      control = (
        <Input
          id={inputId}
          type="number"
          inputMode="decimal"
          min={f.min}
          max={f.max}
          step={f.step ?? "any"}
          placeholder={f.placeholder}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          aria-invalid={Boolean(error) || undefined}
          className="tabular"
        />
      );
      break;
    case "select":
      control = (
        <Select
          id={inputId}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error) || undefined}
        >
          {f.allowEmpty !== undefined ? <option value="">{f.allowEmpty}</option> : null}
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      );
      break;
    case "multiselect": {
      const selected = new Set((value as string[] | null) ?? []);
      control = (
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${inputId}-label`}>
          {f.options.map((o) => {
            const on = selected.has(o.value);
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const next = new Set(selected);
                  if (on) next.delete(o.value);
                  else next.add(o.value);
                  onChange(f.options.map((x) => x.value).filter((v) => next.has(v)));
                }}
                className={cn(
                  "h-8 rounded-full border px-3 text-sm transition-colors",
                  on ? "border-primary bg-primary-soft text-primary" : "border-border text-muted hover:bg-surface-2",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      );
      break;
    }
    case "weekdays": {
      const selected = new Set((value as number[] | null) ?? []);
      control = (
        <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={`${inputId}-label`}>
          {WEEKDAYS.map((w) => {
            const on = selected.has(w.value);
            return (
              <button
                key={w.value}
                type="button"
                aria-pressed={on}
                aria-label={w.label}
                onClick={() => {
                  const next = new Set(selected);
                  if (on) next.delete(w.value);
                  else next.add(w.value);
                  onChange([...next].sort((a, b) => a - b));
                }}
                className={cn(
                  "size-10 rounded-[var(--radius-control)] border text-sm font-semibold transition-colors",
                  on ? "border-primary bg-primary text-primary-fg" : "border-border text-muted hover:bg-surface-2",
                )}
              >
                {w.short}
              </button>
            );
          })}
        </div>
      );
      break;
    }
    case "ordered":
      control = <OrderedPicker options={f.options} value={(value as string[] | null) ?? []} onChange={onChange} />;
      break;
    default: {
      const type = f.type === "datetime" ? "datetime-local" : f.type;
      control = (
        <Input
          id={inputId}
          type={type}
          maxLength={"maxLength" in f ? f.maxLength : undefined}
          placeholder={f.placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error) || undefined}
          className={f.type === "color" ? "w-20 p-1" : undefined}
        />
      );
    }
  }

  return (
    <Field
      label={<span id={`${inputId}-label`}>{label}</span>}
      htmlFor={inputId}
      hint={f.hint}
      error={error}
      className={cn(wide && "sm:col-span-2")}
    >
      {control}
    </Field>
  );
}

function OrderedPicker({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const label = (v: string) => options.find((o) => o.value === v)?.label ?? "Removed";
  const available = options.filter((o) => !value.includes(o.value));
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2">
      {value.length === 0 ? <p className="text-sm text-muted">No stops yet.</p> : null}
      <ol className="flex flex-col gap-1">
        {value.map((v, i) => (
          <li key={v} className="flex items-center gap-2 rounded-[var(--radius-control)] border border-border px-2 py-1">
            <span className="w-6 text-xs font-semibold text-muted tabular">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{label(v)}</span>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
              <ArrowUp aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Move down"
              onClick={() => move(i, 1)}
              disabled={i === value.length - 1}
            >
              <ArrowDown aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Remove ${label(v)}`}
              onClick={() => onChange(value.filter((x) => x !== v))}
            >
              <X aria-hidden />
            </Button>
          </li>
        ))}
      </ol>
      {available.length > 0 ? (
        <Select
          aria-label="Add a stop"
          value=""
          onChange={(e) => {
            if (e.target.value) onChange([...value, e.target.value]);
          }}
        >
          <option value="">Add a stop…</option>
          {available.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ) : null}
    </div>
  );
}
