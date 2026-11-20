import { DamageDiagram, type DamageStroke } from "@/components/domain/damage-diagram";
import { PaperBox, PaperSection } from "@/components/domain/paper-section";
import { SignatureView } from "@/components/domain/signature-pad";
import { parseSignature } from "@/lib/signature";
import type { InspectionRow, SheetData } from "@/components/domain/inspection-data";
import { cn } from "@/lib/cn";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/format";
import {
  INSTRUCTION_LINE,
  MARK_TEXT,
  MINI_FOOTNOTE,
  REVIEW_LINE,
  fmtWorked,
  milesDriven,
  parseResults,
  sheetFooter,
  timeWorkedMinutes,
  toSections,
  type ResultEntry,
} from "@/lib/inspection";

/**
 * Print rules: hide everything except the sheet, force black on white and fit
 * one page. `:has()` keeps the sheet's ancestors and hides their other children.
 */
const PRINT_CSS = `
@media print {
  @page { size: letter; margin: 0.35in; }
  html, body { background: #fff !important; }
  body :not(:has(.paper-sheet)):not(.paper-sheet):not(.paper-sheet *) { display: none !important; }
  :has(.paper-sheet) { display: block !important; position: static !important; overflow: visible !important; height: auto !important; max-height: none !important; width: auto !important; padding: 0 !important; margin: 0 !important; border: 0 !important; transform: none !important; }
  .paper-sheet { --text: #000; --text-muted: #000; --surface: #fff; --surface-2: #fff; --border: #000; --border-strong: #000; --danger: #000; --success: #000; --primary: #000; border: 0 !important; box-shadow: none !important; border-radius: 0 !important; max-width: none !important; font-size: 8.5pt !important; zoom: 0.82; -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff !important; color: #000 !important; }
  .paper-sheet .no-print { display: none !important; }
  .paper-sheet svg { color: #000 !important; }
}
`;

function Line({ label, children, className }: { label: string; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="min-h-6 border-b border-fg px-1 pb-0.5 text-sm font-medium text-fg tabular">{children}</div>
    </div>
  );
}

function pick<K extends keyof InspectionRow>(a: InspectionRow | null, b: InspectionRow | null, key: K): InspectionRow[K] | null {
  return (a?.[key] ?? b?.[key] ?? null) as InspectionRow[K] | null;
}

export function InspectionSheet({
  data,
  timeZone,
  clock24h,
  signoff,
}: {
  data: SheetData;
  timeZone: string;
  clock24h: boolean;
  /** The technician sign-off form, shown on screen (never printed) until someone signs. */
  signoff?: React.ReactNode;
}) {
  const { primary, pre, post, vehicle, shift, items, names } = data;
  const preMap = new Map<string, ResultEntry>(parseResults(pre?.results).map((r) => [r.item_id, r]));
  const postMap = new Map<string, ResultEntry>(parseResults(post?.results).map((r) => [r.item_id, r]));
  const sections = toSections(items);

  const begin = pre?.odometer ?? null;
  const end = post?.odometer ?? null;
  const driven = milesDriven(begin, end);
  const worked = timeWorkedMinutes(shift?.clock_in_at, shift?.clock_out_at);
  const tenEight = shift?.in_service_at ?? null;
  const dateSource = shift?.clock_in_at ?? primary.created_at;

  const damage: DamageStroke[] = [];
  for (const r of [pre, post]) {
    if (r && Array.isArray(r.damage)) damage.push(...(r.damage as unknown as DamageStroke[]));
  }

  const defects = [...preMap.values(), ...postMap.values()].filter((r) => r.mark === "x");
  const notes = [
    pre?.notes ? { who: post?.notes ? "Pre-trip" : "", text: pre.notes } : null,
    post?.notes ? { who: pre?.notes ? "Post-trip" : "", text: post.notes } : null,
  ].filter((n): n is { who: string; text: string } => n !== null);

  const nextBy = pick(post, pre, "next_reviewed_by");
  const nextAt = pick(post, pre, "next_reviewed_at");
  const techSigned = [pre, post].find((r) => r?.technician_signed_at) ?? null;
  const operatorSig = parseSignature(primary.operator_signature);
  const reviewed = Boolean(primary.reviewed_inspection_id);

  return (
    <>
      <style>{PRINT_CSS}</style>
      <article
        className="paper-sheet mx-auto w-full max-w-5xl overflow-hidden rounded-[var(--radius-card)] border border-border-strong bg-surface text-fg"
        aria-label="Vehicle inspection sheet"
      >
        <header className="px-4 pt-4 pb-3">
          <h2 className="text-center text-xl font-extrabold tracking-[0.2em] text-fg">VEHICLE INSPECTION</h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Line label="Bus #">{vehicle?.number}</Line>
            <Line label="Date">{fmtDate(dateSource, timeZone, "MM/dd/yyyy")}</Line>
            <Line label="10-8 Time">{tenEight ? fmtTime(tenEight, timeZone, clock24h) : ""}</Line>
          </div>
          <p className="mt-3 text-[13px] leading-snug text-fg">
            {REVIEW_LINE}
            {reviewed ? <span className="ml-1 font-semibold">(Reviewed)</span> : null}
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Line label="Operator Name (print)">{names[primary.employee_id]}</Line>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Operator Signature</p>
              <div className="border-b border-fg">
                <SignatureView value={operatorSig} label="Operator signature" className="h-12 w-full max-w-60" />
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Line label="End Miles">{end !== null ? end.toLocaleString("en-US") : ""}</Line>
            <Line label="Beginning Miles">{begin !== null ? begin.toLocaleString("en-US") : ""}</Line>
            <Line label="Miles Driven">{driven !== null ? driven.toLocaleString("en-US") : ""}</Line>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <Line label="End Time">{shift?.clock_out_at ? fmtTime(shift.clock_out_at, timeZone, clock24h) : ""}</Line>
            <Line label="Beginning Time">{shift?.clock_in_at ? fmtTime(shift.clock_in_at, timeZone, clock24h) : ""}</Line>
            <Line label="Time Worked">{fmtWorked(worked)}</Line>
          </div>
        </header>

        <p className="border-t border-border-strong px-4 py-2 text-[12px] italic leading-snug text-fg">{INSTRUCTION_LINE}</p>

        <div className="border-t border-border-strong px-4 py-3">
          <DamageDiagram value={damage} readOnly />
        </div>

        {sections.map((s) => (
          <PaperSection
            key={s.title}
            section={s}
            dense
            renderExtra={(it) => {
              if (!it.psi) return null;
              const v = preMap.get(it.id)?.psi ?? postMap.get(it.id)?.psi ?? null;
              return (
                <span className="flex shrink-0 items-end gap-1 text-[11px] font-semibold text-muted">
                  PSI
                  <span className="inline-block min-w-9 border-b border-fg text-center text-xs font-medium text-fg tabular">{v ?? ""}</span>
                </span>
              );
            }}
            renderBoxes={(it) => {
              const a = preMap.get(it.id)?.mark ?? null;
              const b = postMap.get(it.id)?.mark ?? null;
              return (
                <>
                  <PaperBox dense className={a === "x" ? "text-danger" : undefined}>
                    {a ? MARK_TEXT[a] : ""}
                  </PaperBox>
                  <PaperBox dense shaded={it.pre_trip_only} className={b === "x" ? "text-danger" : undefined}>
                    {b && !it.pre_trip_only ? MARK_TEXT[b] : ""}
                  </PaperBox>
                </>
              );
            }}
          />
        ))}
        <p className="border-b border-border-strong px-4 py-1.5 text-[11px] text-muted">{MINI_FOOTNOTE}</p>

        {defects.length ? (
          <div className="border-b border-border-strong px-4 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Items marked X</p>
            <ul className="mt-1 flex flex-col gap-0.5 text-[12px] text-fg">
              {defects.map((d, i) => (
                <li key={`${d.item_id}-${i}`}>
                  <span className="font-semibold">{d.label}</span>
                  {d.note ? `: ${d.note}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="border-b border-border-strong px-4 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Operator Comments</p>
          <div className="min-h-10 text-sm text-fg">
            {notes.length ? (
              notes.map((n, i) => (
                <p key={i} className="whitespace-pre-line">
                  {n.who ? <span className="font-semibold">{n.who}: </span> : null}
                  {n.text}
                </p>
              ))
            ) : null}
          </div>
        </div>

        <div className="border-b border-border-strong px-4 py-2">
          <Line label="NEXT DRIVER REVIEWED THIS DVI:">
            {nextBy ? `${names[nextBy] ?? "Another driver"}${nextAt ? `, ${fmtDateTime(nextAt, timeZone, clock24h)}` : ""}` : ""}
          </Line>
        </div>

        <div className="px-4 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Technician&apos;s Comments</p>
          {techSigned ? (
            <p className="min-h-10 whitespace-pre-line text-sm text-fg">{techSigned.technician_comments}</p>
          ) : (
            <>
              <div className="hidden min-h-10 print:block" />
              {signoff ? <div className="no-print mt-1">{signoff}</div> : <div className="min-h-10 print:hidden" />}
            </>
          )}
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Technician&apos;s Signature</p>
              <div className="border-b border-fg">
                <SignatureView
                  value={parseSignature(techSigned?.technician_signature)}
                  label="Technician signature"
                  className="h-12 w-full max-w-60"
                />
              </div>
              {techSigned?.technician_signed_by ? (
                <p className="mt-0.5 text-[11px] text-muted">{names[techSigned.technician_signed_by]}</p>
              ) : null}
            </div>
            <Line label="Date">
              {techSigned?.technician_signed_at ? fmtDate(techSigned.technician_signed_at, timeZone, "MM/dd/yyyy") : ""}
            </Line>
          </div>
        </div>

        <footer className="border-t border-border-strong px-4 py-1.5 text-right text-[11px] font-semibold text-muted">
          {sheetFooter(vehicle?.vehicle_type)}
        </footer>
      </article>
    </>
  );
}
