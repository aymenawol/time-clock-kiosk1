"use client";

import { CheckCircle2, Plus, Save, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PaperSheet, type PaperHeader, type PaperRow } from "@/components/counts/paper-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAction } from "@/components/ui/use-action";
import { BLOCK_SIZE, entryRowCount, type SheetColumn } from "@/lib/counts/sheet";
import { saveCountSheet, submitCountSheet } from "./actions";

export type CountColumn = SheetColumn;
export type CountRow = PaperRow;

const blank = (): PaperRow => ({ departure_time: "", counts: {} });

export function CountSheet({
  columns,
  initialRows,
  submitted,
  submittedAt,
  header,
  slogan,
}: {
  columns: SheetColumn[];
  initialRows: PaperRow[];
  submitted: boolean;
  submittedAt: string | null;
  header: PaperHeader;
  slogan: string;
}) {
  const [rows, setRows] = useState<PaperRow[]>(() => {
    const n = entryRowCount(initialRows.length);
    return Array.from({ length: n }, (_, i) => initialRows[i] ?? blank());
  });
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [runSave, saving] = useAction(saveCountSheet, { success: "Draft saved", onSuccess: () => setDirty(false) });
  const [runSubmit, submitting] = useAction(submitCountSheet, {
    success: "Counting sheet submitted",
    onSuccess: () => {
      setDirty(false);
      setConfirming(false);
    },
  });
  const busy = saving || submitting;

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const ids = useMemo(() => columns.map((c) => c.id), [columns]);
  const filled = rows.filter((r) => r.departure_time || ids.some((id) => (r.counts[id] ?? 0) > 0)).length;

  const patch = (index: number, fn: (r: PaperRow) => PaperRow) => {
    setDirty(true);
    setRows((prev) => prev.map((r, i) => (i === index ? fn(r) : r)));
  };
  const payload = () => ({ rows: rows.map((r) => ({ departure_time: r.departure_time, counts: r.counts })) });

  return (
    <div className="flex flex-col gap-4">
      {submitted ? (
        <div
          className="flex items-center gap-2 rounded-[var(--radius-card)] border border-success/30 bg-success-soft px-4 py-3 text-sm text-success"
          role="status"
        >
          <CheckCircle2 className="size-5 shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">Submitted</span>
            {submittedAt ? ` ${submittedAt}` : ""}. Ask dispatch if something needs fixing.
          </span>
        </div>
      ) : null}

      <PaperSheet
        slogan={slogan}
        header={header}
        columns={columns}
        rows={rows}
        edit={
          submitted
            ? undefined
            : {
                onTime: (i, v) => patch(i, (r) => ({ ...r, departure_time: v })),
                onCount: (i, id, n) => patch(i, (r) => ({ ...r, counts: { ...r.counts, [id]: n } })),
              }
        }
      />

      {!submitted ? (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 rounded-[var(--radius-card)] border border-border bg-surface/95 p-3 shadow-[var(--shadow-pop)] backdrop-blur">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted">
              {filled} departure{filled === 1 ? "" : "s"} entered
            </span>
            {dirty ? <Badge tone="warning">Unsaved</Badge> : <Badge tone="neutral">Saved</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              size="lg"
              variant="secondary"
              className="col-span-2"
              disabled={busy}
              onClick={() => {
                setDirty(true);
                setRows((prev) => [...prev, ...Array.from({ length: BLOCK_SIZE }, blank)]);
              }}
            >
              <Plus /> Add {BLOCK_SIZE} more rows
            </Button>
            <Button type="button" size="lg" variant="secondary" loading={saving} disabled={busy} onClick={() => void runSave(payload())}>
              <Save /> Save draft
            </Button>
            <Button type="button" size="lg" disabled={busy || filled === 0} onClick={() => setConfirming(true)}>
              <Send /> Submit sheet
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent title="Submit counting sheet?" description="You can't change it after you submit.">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-fg">
              {filled} departure{filled === 1 ? "" : "s"} entered. Check the totals under each column first.
            </p>
            <Button size="xl" className="w-full" loading={submitting} onClick={() => void runSubmit(payload())}>
              <Send /> Submit sheet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
