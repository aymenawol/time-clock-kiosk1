"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { US_TIME_ZONES, WEEKDAYS } from "@/lib/scheduling/datetime";
import { saveGeneral } from "../actions";

export function GeneralForm({
  initial,
}: {
  initial: { name: string; timezone: string; workweekStartsOn: number; clock24h: boolean };
}) {
  const [v, setV] = React.useState(initial);
  const [run, pending, errors] = useAction(saveGeneral, { success: "Settings saved" });
  // Keep a time zone that isn't in the common list selectable.
  const zones: { value: string; label: string }[] = [...US_TIME_ZONES];
  if (!zones.some((z) => z.value === initial.timezone)) zones.push({ value: initial.timezone, label: initial.timezone });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(v);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Organization name" htmlFor="org-name" error={errors.name?.[0]} className="sm:col-span-2">
          <Input id="org-name" value={v.name} maxLength={120} onChange={(e) => setV({ ...v, name: e.target.value })} required />
        </Field>
        <Field label="Time zone" htmlFor="org-tz" error={errors.timezone?.[0]} hint="Every time on screen and every workday boundary uses this zone.">
          <Select id="org-tz" value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })}>
            {zones.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Workweek starts on" htmlFor="org-week" hint="Weekly overtime is counted from this day, at midnight.">
          <Select id="org-week" value={String(v.workweekStartsOn)} onChange={(e) => setV({ ...v, workweekStartsOn: Number(e.target.value) })}>
            {WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-start gap-2 sm:col-span-2">
          <Checkbox id="org-24h" checked={v.clock24h} onChange={(e) => setV({ ...v, clock24h: e.target.checked })} className="mt-0.5" />
          <div>
            <label htmlFor="org-24h" className="text-sm font-medium text-fg">
              Use the 24-hour clock
            </label>
            <p className="text-xs text-muted">Shows 14:30 instead of 2:30 PM.</p>
          </div>
        </div>
      </div>
      <div>
        <Button type="submit" loading={pending}>
          Save
        </Button>
      </div>
    </form>
  );
}
