"use client";

import { Ban, CheckCheck, Copy, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createMeeting, markAllPresent, recordAttendance, setMeetingStatus, updateMeeting } from "@/app/(office)/safety/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { ROLE_LABEL, ROLES } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/supabase/types";
import { formValues } from "./tz";

export interface MeetingInitial {
  id: string;
  title: string;
  audience: AppRole[];
  startsAtInput: string;
  duration: number;
  location: string;
  notes: string;
}

export function MeetingDialog({ initial, timeZone }: { initial?: MeetingInitial; timeZone: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<AppRole[]>(initial?.audience ?? []);
  const [create, creating, createErrors] = useAction(createMeeting, {
    success: "Meeting scheduled",
    onSuccess: (d) => {
      setOpen(false);
      router.push(`/safety/${d.id}`);
    },
  });
  const [update, updating, updateErrors] = useAction(updateMeeting, { success: "Meeting updated", onSuccess: () => setOpen(false) });
  const errors = initial ? updateErrors : createErrors;
  const err = (k: string) => errors[k]?.[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {initial ? (
          <Button variant="secondary">
            <Pencil /> Edit
          </Button>
        ) : (
          <Button>
            <Plus /> New meeting
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={initial ? "Edit meeting" : "Schedule a safety meeting"} description={`Times are in ${timeZone}.`}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const v = formValues(e.currentTarget);
            const payload = {
              title: v.title,
              audience,
              startsAt: v.startsAt,
              duration: v.duration,
              location: v.location,
              notes: v.notes,
            } as never;
            void (initial ? update({ id: initial.id, ...(payload as object) } as never) : create(payload));
          }}
        >
          <Field label="Title" htmlFor="sm-title" error={err("title")}>
            <Input id="sm-title" name="title" required maxLength={120} defaultValue={initial?.title} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" htmlFor="sm-start" error={err("startsAt")}>
              <Input id="sm-start" name="startsAt" type="datetime-local" required defaultValue={initial?.startsAtInput} />
            </Field>
            <Field label="Duration (minutes)" htmlFor="sm-dur" error={err("duration")}>
              <Input id="sm-dur" name="duration" type="number" min={5} max={480} step={5} required defaultValue={initial?.duration ?? 30} />
            </Field>
          </div>
          <Field label="Location" htmlFor="sm-loc" error={err("location")}>
            <Input id="sm-loc" name="location" maxLength={120} defaultValue={initial?.location} />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Who should attend</legend>
            <p className="text-xs text-muted">Leave all unchecked to invite everyone.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ROLES.map((r) => (
                <div key={r} className="flex items-center gap-2">
                  <Checkbox
                    id={`sm-aud-${r}`}
                    checked={audience.includes(r)}
                    onChange={(e) => setAudience((a) => (e.target.checked ? [...a, r] : a.filter((x) => x !== r)))}
                  />
                  <Label htmlFor={`sm-aud-${r}`}>{ROLE_LABEL[r]}</Label>
                </div>
              ))}
            </div>
          </fieldset>
          <Field label="Notes" htmlFor="sm-notes" error={err("notes")}>
            <Textarea id="sm-notes" name="notes" maxLength={2000} defaultValue={initial?.notes} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={creating || updating}>
              {initial ? "Save changes" : "Schedule meeting"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MeetingStatusButtons({ id, status }: { id: string; status: string }) {
  const [run, pending] = useAction(setMeetingStatus, { success: "Meeting updated" });
  if (status === "scheduled") {
    return (
      <>
        <Button variant="secondary" loading={pending} onClick={() => void run({ id, status: "completed" })}>
          <CheckCheck /> Mark complete
        </Button>
        <Button
          variant="ghost"
          className="text-danger"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Cancel this meeting? It disappears from the public schedule.")) void run({ id, status: "cancelled" });
          }}
        >
          <Ban /> Cancel meeting
        </Button>
      </>
    );
  }
  return (
    <Button variant="secondary" loading={pending} onClick={() => void run({ id, status: "scheduled" })}>
      Reopen
    </Button>
  );
}

export function CopyScheduleLink({ token, label = "Copy public link" }: { token: string; label?: string }) {
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        const url = `${window.location.origin}/s/${token}`;
        try {
          await navigator.clipboard.writeText(url);
          toast.success("Link copied. Anyone with it can see upcoming meetings.");
        } catch {
          toast.message(url);
        }
      }}
    >
      <Copy /> {label}
    </Button>
  );
}

export function AttendanceSelect({
  meetingId,
  employeeId,
  name,
  value,
}: {
  meetingId: string;
  employeeId: string;
  name: string;
  value: string;
}) {
  const [run, pending] = useAction(recordAttendance, { success: "Saved" });
  return (
    <Select
      aria-label={`Attendance for ${name}`}
      value={value}
      disabled={pending}
      className="w-36"
      onChange={(e) => void run({ meetingId, employeeId, status: e.target.value as "present" })}
    >
      <option value="" disabled>
        Not recorded
      </option>
      <option value="present">Present</option>
      <option value="late">Late</option>
      <option value="absent">Absent</option>
      <option value="excused">Excused</option>
    </Select>
  );
}

export function MarkAllPresentButton({ meetingId, employeeIds }: { meetingId: string; employeeIds: string[] }) {
  const [run, pending] = useAction(markAllPresent, {
    success: (d: { added: number }): string => (d.added ? `${d.added} marked present` : "Everyone is already recorded"),
  });
  return (
    <Button variant="secondary" loading={pending} onClick={() => void run({ meetingId, employeeIds })}>
      <CheckCheck /> Mark the rest present
    </Button>
  );
}
