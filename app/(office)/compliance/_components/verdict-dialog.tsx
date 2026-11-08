"use client";

import { Check, ClipboardCheck, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";
import { setComplianceVerdict } from "../actions";

export function VerdictDialog({
  shiftId,
  employeeName,
  verdict,
  note,
  suggested,
}: {
  shiftId: string;
  employeeName: string;
  verdict: "ok" | "flag" | null;
  note: string | null;
  suggested: "ok" | "flag";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <ClipboardCheck />
          {verdict ? "Change" : "Review"}
        </Button>
      </DialogTrigger>
      <DialogContent title={`Compliance: ${employeeName}`} description="Confirm whether this shift met meal and rest break rules.">
        {open ? <VerdictForm shiftId={shiftId} verdict={verdict} note={note} suggested={suggested} onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function VerdictForm({
  shiftId,
  verdict,
  note,
  suggested,
  onDone,
}: {
  shiftId: string;
  verdict: "ok" | "flag" | null;
  note: string | null;
  suggested: "ok" | "flag";
  onDone: () => void;
}) {
  const [choice, setChoice] = useState<"ok" | "flag">(verdict ?? suggested);
  const [text, setText] = useState(note ?? "");
  const [run, pending, fieldErrors] = useAction(setComplianceVerdict, { success: "Verdict saved", onSuccess: onDone });
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ shiftId, verdict: choice, note: text });
      }}
    >
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Verdict</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Verdict">
          <button
            type="button"
            role="radio"
            aria-checked={choice === "ok"}
            onClick={() => setChoice("ok")}
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border font-semibold",
              choice === "ok" ? "border-success bg-success text-white" : "border-border bg-surface text-success hover:bg-surface-2",
            )}
          >
            <Check className="size-4" aria-hidden /> OK
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={choice === "flag"}
            onClick={() => setChoice("flag")}
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] border font-semibold",
              choice === "flag" ? "border-danger bg-danger text-white" : "border-border bg-surface text-danger hover:bg-surface-2",
            )}
          >
            <X className="size-4" aria-hidden /> Flag
          </button>
        </div>
        {!verdict ? <p className="mt-1.5 text-xs text-muted">Suggested from the break record: {suggested === "ok" ? "OK" : "Flag"}.</p> : null}
      </fieldset>
      <Field label="Note" htmlFor="verdict-note" hint={choice === "flag" ? "Required when flagging." : "Optional."} error={fieldErrors.note?.[0]}>
        <Textarea id="verdict-note" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} rows={4} />
      </Field>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Save verdict
        </Button>
      </div>
    </form>
  );
}
