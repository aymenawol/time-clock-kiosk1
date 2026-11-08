"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { pctTone } from "@/lib/scheduling/performance";

export interface PerfRow {
  id: string;
  name: string;
  roleLabel: string;
  shifts: number;
  hours: number;
  missedBreaks: number;
  overruns: number;
  inspectionPct: number | null;
  countSheetPct: number | null;
  safetyPct: number | null;
}

type Key = Exclude<keyof PerfRow, "id" | "roleLabel">;

const COLUMNS: { key: Key; label: string; numeric: boolean }[] = [
  { key: "name", label: "Employee", numeric: false },
  { key: "shifts", label: "Shifts", numeric: true },
  { key: "hours", label: "Hours", numeric: true },
  { key: "missedBreaks", label: "Missed breaks", numeric: true },
  { key: "overruns", label: "Overruns", numeric: true },
  { key: "inspectionPct", label: "Inspections", numeric: true },
  { key: "countSheetPct", label: "Count sheets", numeric: true },
  { key: "safetyPct", label: "Safety meetings", numeric: true },
];

export function PerformanceTable({ rows }: { rows: PerfRow[] }) {
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<{ key: Key; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });

  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => !q || r.name.toLowerCase().includes(q));
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      // Missing values (not applicable) always sort last.
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * factor;
      return ((av as number) - (bv as number)) * factor;
    });
  }, [rows, search, sort]);

  const toggle = (key: Key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" }));

  return (
    <div>
      <div className="border-b border-border p-3">
        <label htmlFor="perf-search" className="sr-only">
          Search employees
        </label>
        <Input id="perf-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee…" className="sm:w-64" />
      </div>
      {visible.length === 0 ? (
        <EmptyState title="No employees found" />
      ) : (
        <Table>
          <THead>
            <tr>
              {COLUMNS.map((c) => {
                const active = sort.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                    className={cn("whitespace-nowrap px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted", c.numeric && "text-right")}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      className={cn("inline-flex items-center gap-1 uppercase hover:text-fg", active && "text-fg")}
                    >
                      {c.label}
                      {active ? sort.dir === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden /> : <ArrowUpDown className="size-3 opacity-50" aria-hidden />}
                    </button>
                  </th>
                );
              })}
            </tr>
          </THead>
          <TBody>
            {visible.map((r) => (
              <TR key={r.id}>
                <TD className="min-w-44">
                  <Link href={`/people/${r.id}`} className="font-medium text-primary hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-xs text-muted">{r.roleLabel}</p>
                </TD>
                <TD className="text-right tabular">{r.shifts}</TD>
                <TD className="text-right tabular">{r.hours.toFixed(1)}</TD>
                <TD className={cn("text-right tabular", r.missedBreaks > 0 && "text-danger")}>{r.missedBreaks}</TD>
                <TD className={cn("text-right tabular", r.overruns > 0 && "text-warning")}>{r.overruns}</TD>
                <Pct value={r.inspectionPct} />
                <Pct value={r.countSheetPct} />
                <Pct value={r.safetyPct} />
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

function Pct({ value }: { value: number | null }) {
  return (
    <TD className="text-right">
      {value === null ? <span className="text-muted">-</span> : <Badge tone={pctTone(value)} className="tabular">{value}%</Badge>}
    </TD>
  );
}
