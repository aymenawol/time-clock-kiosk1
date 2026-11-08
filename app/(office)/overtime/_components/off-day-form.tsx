"use client";

import { Plus } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { sendOffDayRequest } from "../actions";

export function OffDayForm({ employees, defaultDate }: { employees: { id: string; name: string }[]; defaultDate: string }) {
  const [open, setOpen] = React.useState(false);
  const [run, pending, errors] = useAction(sendOffDayRequest, { success: "Request sent", onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Send request
      </Button>
      <DialogContent title="Off-day work request" description="Ask an employee if they can work on a day off.">
        <form
          className="flex flex-col gap-4 overflow-y-auto p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void run({
              employee_id: String(fd.get("employee_id") ?? ""),
              work_date: String(fd.get("requested_date") ?? ""),
              message: String(fd.get("message") ?? ""),
            });
          }}
        >
          <Field label="Employee *" htmlFor="od-employee" error={errors.employee_id?.[0]}>
            <Select id="od-employee" name="employee_id" required defaultValue="">
              <option value="">Select employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Requested date *" htmlFor="od-date" error={errors.work_date?.[0]}>
            <Input id="od-date" name="requested_date" type="date" defaultValue={defaultDate} required />
          </Field>
          <Field label="Message" htmlFor="od-message" error={errors.message?.[0]}>
            <Textarea id="od-message" name="message" rows={2} maxLength={1000} required />
          </Field>
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Send request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
