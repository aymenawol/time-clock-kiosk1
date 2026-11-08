"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createEmployee } from "@/app/(office)/people/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { ROLE_LABEL, ROLES } from "@/lib/auth/permissions";
import { formValues } from "./tz";

export function AddEmployee({ minimumWage }: { minimumWage: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState(false);
  const [exempt, setExempt] = useState(false);
  const [run, pending, errors] = useAction(createEmployee, {
    success: "Employee added",
    onSuccess: (d) => {
      setOpen(false);
      router.push(`/people/${d.id}`);
    },
  });
  const err = (k: string) => errors[k]?.[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Add employee
        </Button>
      </DialogTrigger>
      <DialogContent title="Add employee" description="They can clock in at the kiosk as soon as the PIN is set." className="max-w-2xl">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run({ ...formValues(e.currentTarget), daily_ot_exempt: exempt, create_login: login } as never);
          }}
        >
          <Field label="First name" htmlFor="ae-first" error={err("first_name")}>
            <Input id="ae-first" name="first_name" required maxLength={80} autoComplete="off" />
          </Field>
          <Field label="Last name" htmlFor="ae-last" error={err("last_name")}>
            <Input id="ae-last" name="last_name" required maxLength={80} autoComplete="off" />
          </Field>
          <Field label="Employee number" htmlFor="ae-num" hint="3 to 8 digits, unique in your organization" error={err("employee_number")}>
            <Input id="ae-num" name="employee_number" required inputMode="numeric" pattern="\d{3,8}" maxLength={8} autoComplete="off" />
          </Field>
          <Field label="Role" htmlFor="ae-role" error={err("role")}>
            <Select id="ae-role" name="role" defaultValue="driver">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Email" htmlFor="ae-email" error={err("email")}>
            <Input id="ae-email" name="email" type="email" autoComplete="off" />
          </Field>
          <Field label="Phone" htmlFor="ae-phone" error={err("phone")}>
            <Input id="ae-phone" name="phone" type="tel" autoComplete="off" />
          </Field>
          <Field label="Job title" htmlFor="ae-title" error={err("job_title")}>
            <Input id="ae-title" name="job_title" maxLength={80} />
          </Field>
          <Field label="Hire date" htmlFor="ae-hire" error={err("hire_date")}>
            <Input id="ae-hire" name="hire_date" type="date" />
          </Field>
          <Field label="Seniority number" htmlFor="ae-sen" hint="1 is most senior. Used for bids and overtime." error={err("seniority_number")}>
            <Input id="ae-sen" name="seniority_number" type="number" min={1} step={1} />
          </Field>
          <Field label="Pay rate ($ per hour)" htmlFor="ae-rate" error={err("pay_rate")}>
            <Input id="ae-rate" name="pay_rate" type="number" min={0} step="0.01" required defaultValue="0" />
          </Field>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <div className="flex items-center gap-2">
              <Checkbox id="ae-exempt" checked={exempt} onChange={(e) => setExempt(e.target.checked)} />
              <Label htmlFor="ae-exempt">Exempt from daily overtime</Label>
            </div>
            <p className="text-xs text-muted">
              NRS 608.018 daily overtime applies below 1.5 times the minimum wage ({minimumWage}). Exempt only with a reason such
              as a 4x10 schedule, Motor Carrier Act or collective bargaining agreement.
            </p>
            {exempt ? (
              <Field label="Exemption reason" htmlFor="ae-reason" error={err("ot_exempt_reason")}>
                <Input id="ae-reason" name="ot_exempt_reason" maxLength={500} />
              </Field>
            ) : null}
          </div>
          <Field label="Kiosk PIN" htmlFor="ae-pin" hint="4 to 8 digits. Not the employee number, a sequence or a repeated digit." error={err("pin")}>
            <Input id="ae-pin" name="pin" inputMode="numeric" pattern="\d{4,8}" maxLength={8} required autoComplete="off" />
          </Field>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <div className="flex items-center gap-2">
              <Checkbox id="ae-login" checked={login} onChange={(e) => setLogin(e.target.checked)} />
              <Label htmlFor="ae-login">Create a login (phone or desktop)</Label>
            </div>
            {login ? (
              <Field
                label="Temporary password"
                htmlFor="ae-pw"
                hint="At least 10 characters. They must change it at first sign-in. Needs an email above."
                error={err("temp_password")}
              >
                <Input id="ae-pw" name="temp_password" type="text" minLength={10} autoComplete="off" />
              </Field>
            ) : null}
          </div>
          <Field label="Notes" htmlFor="ae-notes" className="sm:col-span-2" error={err("notes")}>
            <Textarea id="ae-notes" name="notes" className="min-h-16" maxLength={2000} />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Add employee
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
