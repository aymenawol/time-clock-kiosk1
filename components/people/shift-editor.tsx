"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { addShift, editBreak, editShift, voidShift } from "@/app/(office)/timesheets/actions";
import { BreakStatusPill } from "@/components/domain/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import type { BreakStatus } from "@/lib/supabase/types";
import { formValues } from "./tz";

const firstError = (e: Record<string, string[]>, k: string) => e[k]?.[0];

export interface BreakView {
  id: string;
  label: string;
  status: BreakStatus;
  startedInput: string;
  endedInput: string;
  startedLabel: string;
  endedLabel: string;
}

export interface ShiftView {
  id: string;
  dateLabel: string;
  status: "active" | "completed" | "void";
  clockInInput: string;
  clockOutInput: string;
  inLabel: string;
  outLabel: string;
  sourceLabel: string;
  editReason: string | null;
  worked: string;
  regular: string;
  dailyOt: string;
  weeklyOt: string;
  breaks: BreakView[];
}

function ReasonField({ errors }: { errors: Record<string, string[]> }) {
  return (
    <Field label="Reason for the change" htmlFor="reason" hint="Saved with the edit and in the audit log." error={firstError(errors, "reason")}>
      <Input id="reason" name="reason" required minLength={3} maxLength={500} />
    </Field>
  );
}

function EditShiftDialog({ shift, timeZone }: { shift: ShiftView; timeZone: string }) {
  const [open, setOpen] = useState(false);
  const [run, pending, errors] = useAction(editShift, { success: "Shift updated", onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Pencil /> Edit times
        </Button>
      </DialogTrigger>
      <DialogContent title="Edit clock times" description={`Times are in ${timeZone}.`}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run({ id: shift.id, ...formValues(e.currentTarget) } as never);
          }}
        >
          <Field label="Clock in" htmlFor="es-in" error={firstError(errors, "clockIn")}>
            <Input id="es-in" name="clockIn" type="datetime-local" required defaultValue={shift.clockInInput} />
          </Field>
          <Field
            label="Clock out"
            htmlFor="es-out"
            hint={shift.status === "active" ? "Leave empty to keep the shift open. Setting a time closes it." : undefined}
            error={firstError(errors, "clockOut")}
          >
            <Input id="es-out" name="clockOut" type="datetime-local" required={shift.status !== "active"} defaultValue={shift.clockOutInput} />
          </Field>
          <ReasonField errors={errors} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VoidShiftDialog({ shift }: { shift: ShiftView }) {
  const [open, setOpen] = useState(false);
  const [run, pending, errors] = useAction(voidShift, { success: "Shift voided", onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-danger">
          <Trash2 /> Void
        </Button>
      </DialogTrigger>
      <DialogContent title="Void this shift?" description="Voided shifts are kept for the record but do not count as hours worked.">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run({ id: shift.id, ...formValues(e.currentTarget) } as never);
          }}
        >
          <ReasonField errors={errors} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={pending}>
              Void shift
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditBreakDialog({ brk, timeZone }: { brk: BreakView; timeZone: string }) {
  const [open, setOpen] = useState(false);
  const [run, pending, errors] = useAction(editBreak, { success: "Break updated", onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={`Edit ${brk.label}`}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent title={`Edit ${brk.label.toLowerCase()}`} description={`Times are in ${timeZone}.`}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run({ id: brk.id, ...formValues(e.currentTarget) } as never);
          }}
        >
          <Field label="Started" htmlFor="eb-start" error={firstError(errors, "startedAt")}>
            <Input id="eb-start" name="startedAt" type="datetime-local" required defaultValue={brk.startedInput} />
          </Field>
          <Field label="Ended" htmlFor="eb-end" hint="Leave empty if the break is still going." error={firstError(errors, "endedAt")}>
            <Input id="eb-end" name="endedAt" type="datetime-local" defaultValue={brk.endedInput} />
          </Field>
          <ReasonField errors={errors} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save break
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ShiftCard({ shift, timeZone, canEdit }: { shift: ShiftView; timeZone: string; canEdit: boolean }) {
  const isVoid = shift.status === "void";
  return (
    <Card className={isVoid ? "opacity-70" : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{shift.dateLabel}</h3>
            {shift.status === "active" ? <Badge tone="primary" dot>Open</Badge> : null}
            {isVoid ? <Badge tone="neutral">Void</Badge> : null}
            {shift.sourceLabel ? <Badge tone="info">{shift.sourceLabel}</Badge> : null}
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {shift.inLabel} to {shift.outLabel}
          </p>
          {shift.editReason ? <p className="mt-1 text-xs text-muted">Last edit: {shift.editReason}</p> : null}
        </div>
        {canEdit && !isVoid ? (
          <div className="flex flex-wrap gap-1">
            <EditShiftDialog shift={shift} timeZone={timeZone} />
            <VoidShiftDialog shift={shift} />
          </div>
        ) : null}
      </div>

      {!isVoid ? (
        <dl className="grid grid-cols-2 gap-3 border-t border-border px-4 py-3 text-sm sm:grid-cols-4">
          {[
            ["Worked", shift.worked],
            ["Regular", shift.regular],
            ["Daily OT", shift.dailyOt],
            ["Weekly OT", shift.weeklyOt],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="tabular font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {shift.breaks.length ? (
        <ul className="divide-y divide-border border-t border-border">
          {shift.breaks.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
              <div className="flex items-center gap-3">
                <span className="font-medium">{b.label}</span>
                <BreakStatusPill status={b.status} />
              </div>
              <div className="flex items-center gap-2 text-muted">
                <span className="tabular">
                  {b.startedLabel} to {b.endedLabel}
                </span>
                {canEdit && !isVoid && b.startedInput ? <EditBreakDialog brk={b} timeZone={timeZone} /> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

export function AddShiftButton({ employeeId, timeZone, name }: { employeeId: string; timeZone: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [run, pending, errors] = useAction(addShift, { success: "Shift added", onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Add missed shift
        </Button>
      </DialogTrigger>
      <DialogContent title="Add a missed shift" description={`For ${name}. Times are in ${timeZone}.`}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run({ employeeId, ...formValues(e.currentTarget) } as never);
          }}
        >
          <Field label="Clock in" htmlFor="as-in" error={firstError(errors, "clockIn")}>
            <Input id="as-in" name="clockIn" type="datetime-local" required />
          </Field>
          <Field label="Clock out" htmlFor="as-out" error={firstError(errors, "clockOut")}>
            <Input id="as-out" name="clockOut" type="datetime-local" required />
          </Field>
          <ReasonField errors={errors} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Add shift
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
