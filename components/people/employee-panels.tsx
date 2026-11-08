"use client";

import { useState } from "react";
import {
  adjustLeave,
  changeRole,
  createLogin,
  removeLogin,
  resetPassword,
  saveCompensation,
  setPin,
  setStatus,
  unlockPin,
  updateProfile,
} from "@/app/(office)/people/actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { ROLE_LABEL, ROLES } from "@/lib/auth/permissions";
import { LEAVE_KINDS, LEAVE_LABEL } from "@/lib/forms";
import type { Employee } from "@/lib/supabase/types";
import { formValues } from "./tz";

const firstError = (e: Record<string, string[]>, k: string) => e[k]?.[0];

export function ProfileForm({ employee }: { employee: Employee }) {
  const [run, pending, errors] = useAction(updateProfile, { success: "Profile saved" });
  const err = (k: string) => firstError(errors, k);
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ id: employee.id, ...formValues(e.currentTarget) } as never);
      }}
    >
      <Field label="First name" htmlFor="pf-first" error={err("first_name")}>
        <Input id="pf-first" name="first_name" defaultValue={employee.first_name} required maxLength={80} />
      </Field>
      <Field label="Last name" htmlFor="pf-last" error={err("last_name")}>
        <Input id="pf-last" name="last_name" defaultValue={employee.last_name} required maxLength={80} />
      </Field>
      <Field label="Employee number" htmlFor="pf-num" hint="Used at the kiosk" error={err("employee_number")}>
        <Input id="pf-num" name="employee_number" defaultValue={employee.employee_number} required inputMode="numeric" maxLength={8} />
      </Field>
      <Field label="Job title" htmlFor="pf-title" error={err("job_title")}>
        <Input id="pf-title" name="job_title" defaultValue={employee.job_title ?? ""} maxLength={80} />
      </Field>
      <Field label="Email" htmlFor="pf-email" error={err("email")}>
        <Input id="pf-email" name="email" type="email" defaultValue={employee.email ?? ""} />
      </Field>
      <Field label="Phone" htmlFor="pf-phone" error={err("phone")}>
        <Input id="pf-phone" name="phone" type="tel" defaultValue={employee.phone ?? ""} />
      </Field>
      <Field label="Hire date" htmlFor="pf-hire" error={err("hire_date")}>
        <Input id="pf-hire" name="hire_date" type="date" defaultValue={employee.hire_date ?? ""} />
      </Field>
      <Field label="Seniority number" htmlFor="pf-sen" hint="1 is most senior" error={err("seniority_number")}>
        <Input id="pf-sen" name="seniority_number" type="number" min={1} step={1} defaultValue={employee.seniority_number ?? ""} />
      </Field>
      <Field label="Notes" htmlFor="pf-notes" className="sm:col-span-2" error={err("notes")}>
        <Textarea id="pf-notes" name="notes" defaultValue={employee.notes ?? ""} className="min-h-20" maxLength={2000} />
      </Field>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" loading={pending}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

export function RoleStatusForm({ employee, isSelf }: { employee: Employee; isSelf: boolean }) {
  const [role, setRole] = useState<string>(employee.role);
  const [status, setStatusValue] = useState<string>(employee.status);
  const [runRole, rolePending] = useAction(changeRole, { success: "Role changed" });
  const [runStatus, statusPending] = useAction(setStatus, {
    success: (): string => (status === "terminated" ? "Employee terminated and login disabled" : "Status updated"),
  });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Field label="Role" htmlFor="rs-role" hint={isSelf ? "Changing your own role may lock you out of this page." : undefined}>
          <Select id="rs-role" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        <div>
          <Button
            variant="secondary"
            loading={rolePending}
            disabled={role === employee.role}
            onClick={() => void runRole({ id: employee.id, role: role as (typeof ROLES)[number] })}
          >
            Change role
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Field
          label="Status"
          htmlFor="rs-status"
          hint="Terminating also disables their login. Re-activating restores it."
        >
          <Select id="rs-status" value={status} onChange={(e) => setStatusValue(e.target.value)}>
            <option value="active">Active</option>
            <option value="on_leave">On leave</option>
            <option value="terminated">Terminated</option>
          </Select>
        </Field>
        <div>
          <Button
            variant={status === "terminated" ? "danger" : "secondary"}
            loading={statusPending}
            disabled={status === employee.status}
            onClick={() => {
              if (status === "terminated" && !window.confirm(`Terminate ${employee.first_name} ${employee.last_name}? Their login will be disabled.`)) return;
              void runStatus({ id: employee.id, status: status as "active" | "on_leave" | "terminated" });
            }}
          >
            Update status
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CompensationForm({
  employeeId,
  payRateCents,
  exempt,
  reason,
  minimumWageCents,
  threshold,
}: {
  employeeId: string;
  payRateCents: number;
  exempt: boolean;
  reason: string | null;
  minimumWageCents: number;
  threshold: string;
}) {
  const [isExempt, setExempt] = useState(exempt);
  const [run, pending, errors] = useAction(saveCompensation, { success: "Compensation saved" });
  void minimumWageCents;
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const v = formValues(e.currentTarget);
        void run({ id: employeeId, pay_rate: v.pay_rate, daily_ot_exempt: isExempt, ot_exempt_reason: v.ot_exempt_reason ?? "" } as never);
      }}
    >
      <Field label="Pay rate ($ per hour)" htmlFor="cp-rate" error={firstError(errors, "pay_rate")} className="max-w-xs">
        <Input id="cp-rate" name="pay_rate" type="number" min={0} step="0.01" defaultValue={(payRateCents / 100).toFixed(2)} required />
      </Field>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Checkbox id="cp-exempt" checked={isExempt} onChange={(e) => setExempt(e.target.checked)} />
          <Label htmlFor="cp-exempt">Exempt from daily overtime</Label>
        </div>
        <p className="text-xs text-muted">
          NRS 608.018: daily overtime (over 8 hours in a 24-hour workday) applies to employees paid less than 1.5 times the
          Nevada minimum wage, which is {threshold} here. It does not apply with a 4x10 schedule, to Motor Carrier Act drivers or
          under a collective bargaining agreement. Weekly overtime over 40 hours always applies.
        </p>
        {isExempt ? (
          <Field label="Exemption reason" htmlFor="cp-reason" error={firstError(errors, "ot_exempt_reason")}>
            <Input id="cp-reason" name="ot_exempt_reason" defaultValue={reason ?? ""} maxLength={500} />
          </Field>
        ) : null}
      </div>
      <div>
        <Button type="submit" loading={pending}>
          Save compensation
        </Button>
      </div>
    </form>
  );
}

export function PinPanel({
  employeeId,
  pinSet,
  lockedUntilLabel,
  failedCount,
}: {
  employeeId: string;
  pinSet: boolean;
  lockedUntilLabel: string | null;
  failedCount: number;
}) {
  const [run, pending, errors] = useAction(setPin, { success: "PIN saved" });
  const [unlock, unlocking] = useAction(unlockPin, { success: "PIN unlocked" });
  return (
    <div className="grid gap-4">
      <div className="text-sm">
        <p>
          {pinSet ? "A PIN is set." : "No PIN is set yet. This employee cannot clock in until you set one."}{" "}
          {failedCount > 0 && !lockedUntilLabel ? `${failedCount} failed attempt${failedCount === 1 ? "" : "s"} so far.` : null}
        </p>
        {lockedUntilLabel ? (
          <p className="mt-1 font-medium text-danger" role="status">
            Locked after too many wrong attempts until {lockedUntilLabel}.
          </p>
        ) : null}
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          void run({ id: employeeId, pin: String(new FormData(form).get("pin") ?? "") }).then((r) => {
            if (r.ok) form.reset();
          });
        }}
      >
        <Field label={pinSet ? "New PIN" : "PIN"} htmlFor="pin-new" hint="4 to 8 digits" error={firstError(errors, "_") ?? firstError(errors, "pin")}>
          <Input id="pin-new" name="pin" inputMode="numeric" pattern="\d{4,8}" maxLength={8} required autoComplete="off" className="w-40" />
        </Field>
        <Button type="submit" loading={pending}>
          {pinSet ? "Reset PIN" : "Set PIN"}
        </Button>
        {lockedUntilLabel || failedCount > 0 ? (
          <Button type="button" variant="secondary" loading={unlocking} onClick={() => void unlock({ id: employeeId })}>
            Unlock
          </Button>
        ) : null}
      </form>
    </div>
  );
}

export function LoginPanel({ employeeId, hasLogin, email }: { employeeId: string; hasLogin: boolean; email: string | null }) {
  const [create, creating, createErrors] = useAction(createLogin, { success: "Login created" });
  const [reset, resetting, resetErrors] = useAction(resetPassword, { success: "Password reset" });
  const [remove, removing] = useAction(removeLogin, { success: "Login removed" });
  const errors = hasLogin ? resetErrors : createErrors;
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted">
        {hasLogin
          ? `Signs in as ${email ?? "their email"}. They must choose a new password after you reset it.`
          : email
            ? `No login yet. Creating one uses ${email}.`
            : "Add an email address to the profile before creating a login."}
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const payload = { id: employeeId, password: formValues(form).password };
          void (hasLogin ? reset(payload) : create(payload)).then((r) => {
            if (r.ok) form.reset();
          });
        }}
      >
        <Field label="Temporary password" htmlFor="lg-pw" hint="At least 10 characters" error={firstError(errors, "password") ?? firstError(errors, "_")}>
          <Input id="lg-pw" name="password" type="text" minLength={10} required autoComplete="off" className="w-64" />
        </Field>
        <Button type="submit" loading={creating || resetting} disabled={!hasLogin && !email}>
          {hasLogin ? "Reset password" : "Create login"}
        </Button>
        {hasLogin ? (
          <Button
            type="button"
            variant="danger"
            loading={removing}
            onClick={() => {
              if (window.confirm("Remove this login? They will no longer be able to sign in on phone or desktop.")) void remove({ id: employeeId });
            }}
          >
            Remove login
          </Button>
        ) : null}
      </form>
    </div>
  );
}

export function LeaveAdjustForm({ employeeId }: { employeeId: string }) {
  const [run, pending, errors] = useAction(adjustLeave, { success: "Leave balance adjusted" });
  return (
    <form
      className="grid gap-3 sm:grid-cols-[10rem_8rem_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        void run({ id: employeeId, ...formValues(form) } as never).then((r) => {
          if (r.ok) form.reset();
        });
      }}
    >
      <Field label="Type" htmlFor="lv-kind">
        <Select id="lv-kind" name="kind" defaultValue="pto">
          {LEAVE_KINDS.map((k) => (
            <option key={k} value={k}>
              {LEAVE_LABEL[k]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Hours (+/-)" htmlFor="lv-hours" error={firstError(errors, "hours")}>
        <Input id="lv-hours" name="hours" type="number" step="0.25" required placeholder="8 or -4" />
      </Field>
      <Field label="Reason" htmlFor="lv-reason" error={firstError(errors, "reason")}>
        <Input id="lv-reason" name="reason" required maxLength={500} placeholder="Accrual, correction, payout" />
      </Field>
      <Button type="submit" loading={pending}>
        Adjust
      </Button>
    </form>
  );
}
