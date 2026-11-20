import { ArrowDown } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/cn";
import { headerCells, parseCount, sheetLayout, columnSums, type SheetColumn } from "@/lib/counts/sheet";
import { stampFont } from "./stamp-font";

export interface PaperHeader {
  /** "Last, First" */
  operator: string;
  /** Shift start and end, "4:00" */
  start: string;
  end: string;
  date: string;
  bus: string;
  /** "06:15-06:30 / 09:45-10:00" */
  breakWindows: string;
  /** "NOV 12 3:53" */
  checkIn: string;
  checkOut: string;
}

export interface PaperRow {
  departure_time: string;
  counts: Record<string, number>;
}

export interface PaperEdit {
  onTime: (index: number, value: string) => void;
  onCount: (index: number, columnId: string, value: number) => void;
}

/** The paper cell grid: a thin dark line on every cell. */
const grid = "border border-border-strong";
const bar = "sheet-bar bg-fg text-bg";
const input =
  "cell h-11 w-full min-w-0 bg-transparent text-center tabular text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:h-9";

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0 border border-border-strong px-2 py-1", className)}>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="min-h-6 truncate text-sm font-medium text-fg">{children}</dd>
    </div>
  );
}

function Stamp({ value }: { value: string }) {
  return (
    <span
      className={cn(stampFont.className, "block text-2xl leading-6 tracking-widest text-fg opacity-80")}
      aria-label={value || "empty"}
    >
      {value}
    </span>
  );
}

/**
 * The paper passenger counting sheet: slogan, header box, grouped column
 * headings in black bars, blocks of three rows with shaded subtotals, and one
 * total per column (never a grand total). Read-only unless `edit` is given.
 */
export function PaperSheet({
  slogan,
  header,
  columns,
  rows,
  edit,
  className,
  caption = "Passengers counted per departure and location",
}: {
  slogan: string;
  header: PaperHeader;
  columns: SheetColumn[];
  /** Entry rows to show, already padded to whole blocks of three. */
  rows: PaperRow[];
  edit?: PaperEdit;
  className?: string;
  caption?: string;
}) {
  const ids = columns.map((c) => c.id);
  const cells = headerCells(columns);
  const hasGroups = cells.some((c) => c.kind === "group");
  const items = sheetLayout(rows.length);
  const totals = columnSums(rows, ids);
  const span = columns.length + 1;

  return (
    <div className={cn("paper-sheet w-full min-w-0 rounded-[var(--radius-card)] border-2 border-border-strong bg-surface p-2 sm:p-3", className)}>
      {slogan ? <p className="mb-2 text-center text-sm font-semibold italic tracking-wide text-fg">{slogan}</p> : null}

      <dl className="mb-2 grid grid-cols-2 sm:grid-cols-4">
        <Field label="Operator" className="col-span-2">
          <span className="flex items-baseline gap-2">
            <span className="tabular" title="Shift start">
              <span className="sr-only">Shift start </span>
              {header.start || " "}
            </span>
            <span className="min-w-0 flex-1 truncate text-center font-semibold">{header.operator}</span>
            <span className="tabular" title="Shift end">
              <span className="sr-only">Shift end </span>
              {header.end || " "}
            </span>
          </span>
        </Field>
        <Field label="Date">{header.date}</Field>
        <Field label="BUS #">{header.bus}</Field>
        <Field label="BRK Windows" className="col-span-2">
          <span className="tabular text-[13px]">{header.breakWindows}</span>
        </Field>
        <Field label="Check-In">
          <Stamp value={header.checkIn} />
        </Field>
        <Field label="Check-Out">
          <Stamp value={header.checkOut} />
        </Field>
      </dl>

      <table className="w-full table-fixed border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          <col className="w-[4.6rem] sm:w-28" />
          {columns.map((c) => (
            <col key={c.id} />
          ))}
        </colgroup>
        <thead>
          <tr className={bar}>
            <th scope="col" rowSpan={hasGroups ? 2 : 1} className={cn(grid, "px-1 py-1 text-[11px] font-bold uppercase leading-tight")}>
              Time Departing RAC
            </th>
            {cells.map((c) =>
              c.kind === "group" ? (
                <th key={`g-${c.label}-${c.columns[0].id}`} scope="colgroup" colSpan={c.columns.length} className={cn(grid, "px-1 py-1 text-xs font-bold uppercase")}>
                  {c.label}
                </th>
              ) : (
                <th key={c.column.id} scope="col" rowSpan={hasGroups ? 2 : 1} className={cn(grid, "px-0.5 py-1 text-[11px] font-bold uppercase leading-tight")}>
                  {c.column.label}
                </th>
              ),
            )}
          </tr>
          {hasGroups ? (
            <tr className={bar}>
              {cells.flatMap((c) =>
                c.kind === "group"
                  ? c.columns.map((col) => (
                      <th key={col.id} scope="col" className={cn(grid, "px-0.5 py-1 text-[11px] font-bold uppercase")}>
                        {col.label}
                      </th>
                    ))
                  : [],
              )}
            </tr>
          ) : null}
        </thead>
        <tbody>
          {items.map((it) => {
            if (it.type === "subtotal") {
              const s = columnSums(rows, ids, it.from, it.to);
              return (
                <tr key={`s-${it.block}`} className="sheet-shade bg-surface-3">
                  <th scope="row" className={cn(grid, "px-1 py-0.5 text-right text-[11px] font-bold uppercase")}>
                    Subtotal
                  </th>
                  {columns.map((c) => (
                    <td key={c.id} aria-label={`Subtotal ${it.block} ${c.heading}`} className={cn(grid, "px-0.5 py-0.5 text-center text-sm font-semibold tabular")}>
                      <span className="cell block min-h-6 leading-6">
                        {s[c.id] || ""}
                      </span>
                    </td>
                  ))}
                </tr>
              );
            }
            const i = it.index;
            const r = rows[i];
            return (
              <tr key={`r-${i}`}>
                <td className={cn(grid, "p-0")}>
                  {edit ? (
                    <input
                      type="time"
                      aria-label={`Row ${i + 1} departure time`}
                      value={r.departure_time}
                      onChange={(e) => edit.onTime(i, e.target.value)}
                      className={cn(input, "px-0.5 text-xs [&::-webkit-calendar-picker-indicator]:hidden sm:text-sm")}
                    />
                  ) : (
                    <span className="cell block min-h-8 px-1 text-center leading-8 tabular">{r.departure_time}</span>
                  )}
                </td>
                {columns.map((c) => (
                  <td key={c.id} className={cn(grid, "p-0")}>
                    {edit ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        enterKeyHint="next"
                        autoComplete="off"
                        aria-label={`Row ${i + 1} ${c.heading}`}
                        value={r.counts[c.id] ? String(r.counts[c.id]) : ""}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => edit.onCount(i, c.id, parseCount(e.target.value))}
                        className={cn(input, "text-base")}
                      />
                    ) : (
                      <span className="cell block min-h-8 text-center leading-8 tabular">{r.counts[c.id] || ""}</span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className={cn(bar, "px-1 py-1 text-xs font-bold uppercase tracking-wide")}>
              Totals
            </th>
            {columns.map((c) => (
              <td key={c.id} className="py-0.5 text-center text-fg" aria-hidden>
                <ArrowDown className="mx-auto size-4" />
              </td>
            ))}
          </tr>
          <tr>
            <td className="px-1 text-right text-[10px] uppercase text-muted" />
            {columns.map((c) => (
              <td key={c.id} aria-label={`Total ${c.heading}`} className="border-2 border-fg p-0 text-center">
                <span className="cell block min-h-9 text-base font-bold leading-9 tabular">
                  {totals[c.id] || ""}
                </span>
              </td>
            ))}
          </tr>
          <tr>
            <td colSpan={span} className="pt-2 text-center text-xs font-semibold text-fg">
              Total each column separately - DO NOT give a Grand Total.
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
