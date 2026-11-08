"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { saveSection } from "../actions";
import type { SettingField } from "../_lib/sections";

type Values = Record<string, number | boolean | string | null>;

/** Show stored values the way people think of them (hours, dollars) and store them back scaled. */
const toShown = (f: SettingField, v: unknown): number | boolean | string | null => {
  if (f.type === "number") return typeof v === "number" ? Math.round((v / (f.scale ?? 1)) * 10000) / 10000 : null;
  if (f.type === "boolean") return Boolean(v);
  return typeof v === "string" ? v : "";
};

export function SectionForm({ section, fields, initial }: { section: string; fields: SettingField[]; initial: Record<string, unknown> }) {
  const [values, setValues] = React.useState<Values>(() => Object.fromEntries(fields.map((f) => [f.key, toShown(f, initial[f.key])])));
  const [run, pending] = useAction(saveSection, { success: "Settings saved" });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const out: Record<string, number | boolean | string | null> = {};
    for (const f of fields) {
      const v = values[f.key];
      out[f.key] = f.type === "number" && typeof v === "number" ? Math.round(v * (f.scale ?? 1)) : v;
    }
    void run({ section, values: out });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => {
          const id = `set-${f.key}`;
          if (f.type === "boolean") {
            return (
              <div key={f.key} className="flex items-start gap-2 sm:col-span-2">
                <Checkbox
                  id={id}
                  checked={Boolean(values[f.key])}
                  onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.checked }))}
                  className="mt-0.5"
                />
                <div>
                  <label htmlFor={id} className="text-sm font-medium text-fg">
                    {f.label}
                  </label>
                  {f.hint ? <p className="text-xs text-muted">{f.hint}</p> : null}
                </div>
              </div>
            );
          }
          return (
            <Field key={f.key} label={f.label} htmlFor={id} hint={f.hint}>
              {f.type === "select" ? (
                <Select id={id} value={String(values[f.key] ?? "")} onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={id}
                  type="number"
                  inputMode="decimal"
                  min={f.min}
                  max={f.max}
                  step={f.step ?? 1}
                  className="tabular"
                  value={values[f.key] === null || values[f.key] === undefined ? "" : String(values[f.key])}
                  onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value === "" ? null : Number(e.target.value) }))}
                />
              )}
            </Field>
          );
        })}
      </div>
      <div>
        <Button type="submit" loading={pending}>
          Save
        </Button>
      </div>
    </form>
  );
}
