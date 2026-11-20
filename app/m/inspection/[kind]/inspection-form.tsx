"use client";

import { AlertTriangle, Check, FileText, Save, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DamageDiagram, damageMarkCount, type DamageStroke } from "@/components/domain/damage-diagram";
import { PaperBox, PaperSection } from "@/components/domain/paper-section";
import { SignaturePad, type SignatureStroke } from "@/components/domain/signature-pad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";
import {
  INSTRUCTION_LINE,
  MARK_TEXT,
  MINI_FOOTNOTE,
  REVIEW_LINE,
  isItemActive,
  milesDriven,
  milesError,
  nextMark,
  toSections,
  type InspectionKind,
  type Mark,
  type PaperItem,
} from "@/lib/inspection";
import { saveInspection, submitInspection } from "../actions";

export type ChecklistItem = PaperItem;

export interface Answer {
  mark: Mark | null;
  psi: string;
  note: string;
}

export interface PreviousSummary {
  id: string;
  operatorName: string;
  when: string;
  kindLabel: string;
  xItems: { label: string; note: string | null }[];
  notes: string | null;
}

export interface FormHeader {
  date: string;
  tenEight: string;
  operatorName: string;
  beginTime: string;
  endTime: string;
  timeWorked: string;
}

/** What the driver marked on the pre-trip, shown read-only on the post-trip. */
export interface PreMark {
  mark: Mark | null;
  psi: number | null;
}

const MARK_STYLE: Record<Mark, string> = {
  ok: "border-success bg-success-soft text-success",
  x: "border-danger bg-danger-soft text-danger",
  na: "border-border-strong bg-surface-2 text-muted",
};

function ReadOnlyField({ label, id, value }: { label: string; id: string; value: string }) {
  return (
    <Field label={label} htmlFor={id}>
      <Input id={id} readOnly value={value} className="h-12 bg-surface-2 text-base" />
    </Field>
  );
}

export function InspectionForm({
  kind,
  vehicleNumber,
  header,
  lastOdometer,
  preOdometer,
  items,
  preMarks,
  previous,
  initial,
}: {
  kind: InspectionKind;
  vehicleNumber: string;
  header: FormHeader;
  lastOdometer: number | null;
  /** Odometer saved at pre-trip: the beginning miles on the post-trip form. */
  preOdometer: number | null;
  items: PaperItem[];
  preMarks: Record<string, PreMark>;
  /** Pre-trip only. Null when no one else has inspected this vehicle. */
  previous: PreviousSummary | null;
  initial: {
    answers: Record<string, Answer>;
    odometer: number | null;
    notes: string;
    damage: DamageStroke[];
    signature: SignatureStroke[];
    reviewed: boolean;
  };
}) {
  const [answers, setAnswers] = useState<Record<string, Answer>>(initial.answers);
  const [odometer, setOdometer] = useState(initial.odometer !== null ? String(initial.odometer) : "");
  const [notes, setNotes] = useState(initial.notes);
  const [damage, setDamage] = useState<DamageStroke[]>(initial.damage);
  const [signature, setSignature] = useState<SignatureStroke[]>(initial.signature);
  const [reviewed, setReviewed] = useState(initial.reviewed);
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const [runSave, saving, saveErrors] = useAction(saveInspection, {
    success: "Draft saved",
    onSuccess: () => setDirty(false),
  });
  const [runSubmit, submitting] = useAction(submitInspection, {
    success: (r) =>
      r.critical
        ? "Inspection submitted. The vehicle is going to the shop."
        : r.defects
          ? `Inspection submitted with ${r.defects} defect${r.defects === 1 ? "" : "s"}.`
          : "Inspection submitted. All items passed.",
    onSuccess: () => {
      setDirty(false);
      setConfirming(false);
    },
  });

  // Warn before leaving with unsaved answers.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const sections = useMemo(() => toSections(items), [items]);
  const active = useMemo(() => items.filter((it) => isItemActive(kind, it)), [items, kind]);
  const markOf = (id: string) => answers[id]?.mark ?? null;

  const answered = active.filter((it) => markOf(it.id) !== null).length;
  const failed = active.filter((it) => markOf(it.id) === "x");
  const criticalFailed = failed.filter((it) => it.critical);
  const missingNotes = failed.filter((it) => !answers[it.id]?.note.trim());

  const odoNum = odometer.trim() === "" ? null : Number(odometer);
  const begin = kind === "pre_trip" ? odoNum : preOdometer;
  const end = kind === "pre_trip" ? null : odoNum;
  const mileErr = kind === "post_trip" ? milesError(begin, end) : null;
  const driven = milesDriven(begin, end);
  const marksDrawn = damageMarkCount(damage);

  function touch() {
    setDirty(true);
  }

  function set(id: string, patch: Partial<Answer>) {
    touch();
    setAnswers((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { mark: null, psi: "", note: "" }), ...patch } }));
  }

  function cycle(id: string) {
    const next = nextMark(markOf(id));
    set(id, { mark: next, ...(next === "x" ? {} : { note: "" }) });
  }

  function markRestOk(group: PaperItem[]) {
    touch();
    setAnswers((prev) => {
      const out = { ...prev };
      for (const it of group) {
        if (isItemActive(kind, it) && (out[it.id]?.mark ?? null) === null) {
          out[it.id] = { mark: "ok", psi: out[it.id]?.psi ?? "", note: "" };
        }
      }
      return out;
    });
  }

  function payload() {
    return {
      kind,
      answers: active.map((it) => {
        const a = answers[it.id];
        const psi = a?.psi.trim() ? Number(a.psi) : null;
        return { itemId: it.id, mark: a?.mark ?? null, psi, note: a?.note ?? "" };
      }),
      odometer: odoNum,
      notes,
      damage,
      signature,
      reviewedInspectionId: kind === "pre_trip" && previous && reviewed ? previous.id : null,
    };
  }

  function trySubmit() {
    setShowErrors(true);
    const firstOpen = active.find((it) => markOf(it.id) === null) ?? missingNotes[0];
    if (firstOpen) {
      toast.error(
        answered < active.length
          ? `${active.length - answered} item${active.length - answered === 1 ? " still needs" : "s still need"} OK, X or NA.`
          : "Add a short note to every item marked X.",
      );
      document.getElementById(`item-${firstOpen.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (odoNum === null) {
      toast.error(kind === "pre_trip" ? "Enter the beginning miles." : "Enter the end miles.");
      document.getElementById("odometer")?.focus();
      return;
    }
    if (mileErr) {
      toast.error(mileErr);
      document.getElementById("odometer")?.focus();
      return;
    }
    if (kind === "pre_trip" && previous && !reviewed) {
      toast.error("Review the previous operator's report and tick the box.");
      document.getElementById("reviewed")?.focus();
      return;
    }
    if (!signature.length) {
      toast.error("Sign the inspection before you submit it.");
      document.getElementById("operator-signature")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setConfirming(true);
  }

  const busy = saving || submitting;
  const odoInput = (
    <Input
      id="odometer"
      type="text"
      inputMode="numeric"
      className="h-12 font-mono text-lg"
      aria-invalid={mileErr ? true : undefined}
      value={odometer}
      onChange={(e) => {
        touch();
        setOdometer(e.target.value.replace(/[^\d]/g, "").slice(0, 7));
      }}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden">
        <div className="border-b border-border bg-surface-2 px-4 py-2 text-center">
          <h2 className="text-base font-extrabold tracking-[0.2em] text-fg">VEHICLE INSPECTION</h2>
        </div>
        <CardBody className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            <ReadOnlyField label="Bus #" id="bus-number" value={vehicleNumber} />
            <ReadOnlyField label="Date" id="date" value={header.date} />
            <ReadOnlyField label="10-8 Time" id="ten-eight" value={header.tenEight} />
          </div>

          <p className="text-sm leading-snug text-fg">{REVIEW_LINE}</p>

          {kind === "pre_trip" ? (
            previous ? (
              <div className="rounded-[var(--radius-control)] border border-border bg-surface-2/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Previous operator&apos;s report</p>
                <p className="mt-1 text-sm text-fg">
                  <span className="font-semibold">{previous.operatorName}</span>, {previous.kindLabel}, {previous.when}
                </p>
                {previous.xItems.length ? (
                  <ul className="mt-1.5 flex flex-col gap-0.5 text-sm text-danger">
                    {previous.xItems.map((x, i) => (
                      <li key={i}>
                        <span className="font-semibold">X {x.label}</span>
                        {x.note ? <span className="text-fg">: {x.note}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-sm text-muted">No items were marked X.</p>
                )}
                {previous.notes ? <p className="mt-1.5 whitespace-pre-line text-sm text-fg">Comments: {previous.notes}</p> : null}
                <Link
                  href={`/m/inspections/${previous.id}`}
                  className="mt-2 inline-flex h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline"
                >
                  <FileText className="size-4" aria-hidden /> View the report
                </Link>
                <label
                  htmlFor="reviewed"
                  className={cn(
                    "mt-1 flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border px-3 py-2 text-sm font-medium text-fg",
                    showErrors && !reviewed ? "border-danger bg-danger-soft/60" : "border-border bg-surface",
                  )}
                >
                  <Checkbox className="size-5"
                    id="reviewed"
                    checked={reviewed}
                    onChange={(e) => {
                      touch();
                      setReviewed(e.target.checked);
                    }}
                  />
                  I have reviewed the previous operator&apos;s vehicle inspection report
                </label>
              </div>
            ) : (
              <p className="rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-sm text-muted">
                No previous inspection report for this vehicle, so there is nothing to review.
              </p>
            )
          ) : null}

          <ReadOnlyField label="Operator Name (print)" id="operator-name" value={header.operatorName} />
          <div id="operator-signature" className="scroll-mt-20">
            <p className="mb-1 text-sm font-medium text-fg">
              Operator Signature <span className="text-danger">*</span>
            </p>
            <SignaturePad
              value={signature}
              onChange={(s) => {
                touch();
                setSignature(s);
              }}
              label="Operator signature pad"
            />
            {showErrors && !signature.length ? (
              <p role="alert" className="mt-1 text-sm text-danger">
                Sign here to submit.
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {kind === "post_trip" ? (
              <Field label="End Miles" htmlFor="odometer" error={mileErr ?? saveErrors.odometer?.[0]}>
                {odoInput}
              </Field>
            ) : (
              <Field label="End Miles" htmlFor="odometer-end" hint="Entered on the post-trip">
                <Input id="odometer-end" disabled className="h-12 font-mono text-lg" />
              </Field>
            )}
            {kind === "pre_trip" ? (
              <Field
                label="Beginning Miles"
                htmlFor="odometer"
                hint={lastOdometer !== null ? `Last recorded ${lastOdometer.toLocaleString("en-US")}` : undefined}
                error={saveErrors.odometer?.[0]}
              >
                {odoInput}
              </Field>
            ) : (
              <Field label="Beginning Miles" htmlFor="odometer-begin" hint={preOdometer === null ? "No pre-trip reading saved" : undefined}>
                <Input id="odometer-begin" readOnly value={preOdometer !== null ? String(preOdometer) : ""} className="h-12 bg-surface-2 font-mono text-lg" />
              </Field>
            )}
            <Field label="Miles Driven" htmlFor="miles-driven" className="col-span-2">
              <Input id="miles-driven" readOnly value={driven !== null ? driven.toLocaleString("en-US") : ""} className="h-12 bg-surface-2 font-mono text-lg" />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <ReadOnlyField label="End Time" id="end-time" value={header.endTime} />
            <ReadOnlyField label="Beginning Time" id="begin-time" value={header.beginTime} />
            <ReadOnlyField label="Time Worked" id="time-worked" value={header.timeWorked} />
          </div>
        </CardBody>
      </Card>

      <p className="px-1 text-sm italic leading-snug text-muted">{INSTRUCTION_LINE}</p>

      <Card>
        <div className="px-4 pt-3 pb-1">
          <p className="text-sm font-semibold text-fg">Damage</p>
          <p className="text-xs text-muted">Tap the bus where you see new damage. Leave it blank if there is none.</p>
        </div>
        <CardBody>
          <DamageDiagram
            value={damage}
            onChange={(d) => {
              touch();
              setDamage(d);
            }}
          />
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        {sections.map((section) => {
          const group = [...section.left, ...section.right];
          const open = group.filter((it) => isItemActive(kind, it) && markOf(it.id) === null).length;
          return (
            <PaperSection
              key={section.title}
              section={section}
              actions={
                open > 0 ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => markRestOk(group)}>
                    <Check /> Mark the rest OK
                  </Button>
                ) : null
              }
              renderExtra={(it) => {
                if (!it.psi) return null;
                if (kind === "post_trip") {
                  const v = preMarks[it.id]?.psi;
                  return v != null ? <span className="shrink-0 text-xs text-muted tabular">PSI {v}</span> : null;
                }
                return (
                  <label className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted">
                    PSI
                    <Input
                      inputMode="numeric"
                      aria-label={`${it.label} PSI`}
                      className="h-11 w-16 px-2 text-center font-mono"
                      value={answers[it.id]?.psi ?? ""}
                      onChange={(e) => set(it.id, { psi: e.target.value.replace(/[^\d]/g, "").slice(0, 3) })}
                    />
                  </label>
                );
              }}
              renderBoxes={(it) => {
                const pre = preMarks[it.id]?.mark ?? null;
                const mark = markOf(it.id);
                const missing = showErrors && isItemActive(kind, it) && (mark === null || (mark === "x" && !answers[it.id]?.note.trim()));
                const shaded = it.pre_trip_only;
                if (kind === "pre_trip") {
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => cycle(it.id)}
                        aria-label={`${it.label}, pre-trip: ${mark ? MARK_TEXT[mark] : "not marked"}. Tap to change.`}
                        className={cn(
                          "flex h-11 w-14 items-center justify-center rounded-[3px] border text-sm font-bold transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          mark ? MARK_STYLE[mark] : "border-2 border-primary bg-surface text-muted hover:bg-primary/10",
                          missing && "border-danger ring-2 ring-danger/40",
                        )}
                      >
                        {mark ? MARK_TEXT[mark] : ""}
                      </button>
                      <PaperBox shaded={shaded} className={shaded ? undefined : "border-dashed bg-transparent opacity-40"} />
                    </>
                  );
                }
                const live = isItemActive(kind, it);
                return (
                  <>
                    <PaperBox className={pre === "x" ? "text-danger" : undefined}>{pre ? MARK_TEXT[pre] : ""}</PaperBox>
                    {live ? (
                      <button
                        type="button"
                        onClick={() => cycle(it.id)}
                        aria-label={`${it.label}, post-trip: ${mark ? MARK_TEXT[mark] : "not marked"}. Tap to change.`}
                        className={cn(
                          "flex h-11 w-14 items-center justify-center rounded-[3px] border text-sm font-bold transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          mark ? MARK_STYLE[mark] : "border-2 border-primary bg-surface text-muted hover:bg-primary/10",
                          missing && "border-danger ring-2 ring-danger/40",
                        )}
                      >
                        {mark ? MARK_TEXT[mark] : ""}
                      </button>
                    ) : (
                      <PaperBox shaded={shaded} className={shaded ? undefined : "border-dashed bg-transparent opacity-40"} />
                    )}
                  </>
                );
              }}
              renderBelow={(it) => {
                const a = answers[it.id];
                if (!isItemActive(kind, it) || a?.mark !== "x") return null;
                return (
                  <div className="mt-1.5">
                    <label htmlFor={`note-${it.id}`} className="sr-only">
                      What is wrong with {it.label}?
                    </label>
                    <Input
                      id={`note-${it.id}`}
                      value={a.note}
                      maxLength={300}
                      placeholder="What's wrong? (required)"
                      aria-invalid={showErrors && !a.note.trim() ? true : undefined}
                      className="h-12 text-base"
                      onChange={(e) => set(it.id, { note: e.target.value })}
                    />
                    {it.critical ? <p className="mt-1 text-xs text-danger">An X on a critical item puts the vehicle in the shop.</p> : null}
                  </div>
                );
              }}
            />
          );
        })}
        <p className="px-4 py-2 text-xs text-muted">{MINI_FOOTNOTE}</p>
      </Card>

      <Card>
        <CardBody>
          <Field label="Operator Comments" htmlFor="notes" hint="Optional">
            <Textarea
              id="notes"
              maxLength={2000}
              rows={4}
              value={notes}
              onChange={(e) => {
                touch();
                setNotes(e.target.value);
              }}
            />
          </Field>
        </CardBody>
      </Card>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-1 rounded-[var(--radius-card)] border border-border bg-surface/95 p-3 shadow-[var(--shadow-pop)] backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-2 text-sm">
          <span className="tabular text-muted">
            <span className="font-semibold text-fg">{answered}</span> of {active.length} checked
          </span>
          {failed.length ? (
            <Badge tone={criticalFailed.length ? "danger" : "warning"}>
              {failed.length} marked X{criticalFailed.length ? ` · ${criticalFailed.length} critical` : ""}
            </Badge>
          ) : null}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${active.length ? (answered / active.length) * 100 : 0}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
          <Button type="button" size="lg" variant="secondary" loading={saving} disabled={busy} onClick={() => void runSave(payload())}>
            <Save /> {dirty ? "Save" : "Saved"}
          </Button>
          <Button type="button" size="lg" disabled={busy} onClick={trySubmit}>
            <Send /> Submit
          </Button>
        </div>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent
          title={`Submit ${kind === "pre_trip" ? "pre-trip" : "post-trip"} inspection?`}
          description={`Vehicle ${vehicleNumber}. You can't change it after you submit.`}
        >
          <div className="flex flex-col gap-4">
            {failed.length ? (
              <div className="flex flex-col gap-2">
                {criticalFailed.length ? (
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-[var(--radius-control)] bg-danger-soft px-3 py-2 text-sm text-danger"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    A critical item is marked X. Vehicle {vehicleNumber} goes to the shop and dispatch is told.
                  </p>
                ) : null}
                <p className="text-sm font-medium text-fg">
                  {failed.length} defect{failed.length === 1 ? "" : "s"} will be reported:
                </p>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {failed.map((it) => (
                    <li key={it.id} className="rounded-[var(--radius-control)] bg-surface-2 px-3 py-2">
                      <span className="font-medium text-fg">{it.label}</span>
                      {it.critical ? <span className="text-danger"> · critical</span> : null}
                      <span className="block text-muted">{answers[it.id]?.note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-success">
                <Check className="size-4" /> All {active.length} items passed.
              </p>
            )}
            {marksDrawn ? (
              <p className="text-sm text-muted">
                {marksDrawn} damage mark{marksDrawn === 1 ? "" : "s"} on the diagram.
              </p>
            ) : null}
            <Button
              size="xl"
              className="w-full"
              variant={criticalFailed.length ? "danger" : "primary"}
              loading={submitting}
              onClick={() => void runSubmit(payload())}
            >
              <Send /> Submit inspection
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
