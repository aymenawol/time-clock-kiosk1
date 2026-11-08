import { paidSegments } from "@/lib/labor/overtime";
import type { ShiftRecord } from "@/lib/labor/types";

export interface PerfShift {
  record: ShiftRecord;
  /** A vehicle was assigned, so inspections and count sheets were expected. */
  hasVehicle: boolean;
  missedBreaks: number;
  overrunBreaks: number;
}

export interface PerfInputs {
  shifts: PerfShift[];
  /** Submitted inspections: pre_trip and post_trip per shift. */
  inspections: { shiftId: string; kind: string }[];
  /** Shift ids that have a submitted count sheet. */
  countSheetShiftIds: string[];
  /** Safety meeting attendance rows (status present, late, absent or excused). */
  attendance: { status: string }[];
  /** Whether count sheets are part of this person's job (drivers). */
  countsExpected: boolean;
  now?: Date;
}

export interface Performance {
  shifts: number;
  minutes: number;
  missedBreaks: number;
  overruns: number;
  /** Percentages 0-100, or null when nothing was expected. */
  inspectionPct: number | null;
  countSheetPct: number | null;
  safetyPct: number | null;
}

const pct = (done: number, expected: number) => (expected > 0 ? Math.min(100, Math.round((done / expected) * 100)) : null);

/** Per-employee metrics for the performance page (shifts already limited to the period). */
export function computePerformance(input: PerfInputs): Performance {
  const now = input.now ?? new Date();
  let minutes = 0;
  let missedBreaks = 0;
  let overruns = 0;
  let withVehicle = 0;
  let inspectionsDone = 0;
  let countsDone = 0;
  const counts = new Set(input.countSheetShiftIds);

  for (const s of input.shifts) {
    for (const seg of paidSegments(s.record, now).segments) minutes += (seg.end - seg.start) / 60_000;
    missedBreaks += s.missedBreaks;
    overruns += s.overrunBreaks;
    if (s.hasVehicle) {
      withVehicle += 1;
      const kinds = new Set(input.inspections.filter((i) => i.shiftId === s.record.id).map((i) => i.kind));
      inspectionsDone += (kinds.has("pre_trip") ? 1 : 0) + (kinds.has("post_trip") ? 1 : 0);
      if (counts.has(s.record.id)) countsDone += 1;
    }
  }

  const attended = input.attendance.filter((a) => a.status === "present" || a.status === "late").length;
  const absent = input.attendance.filter((a) => a.status === "absent").length;

  return {
    shifts: input.shifts.length,
    minutes: Math.round(minutes),
    missedBreaks,
    overruns,
    inspectionPct: pct(inspectionsDone, withVehicle * 2),
    countSheetPct: input.countsExpected ? pct(countsDone, withVehicle) : null,
    safetyPct: pct(attended, attended + absent),
  };
}

/** v0 colour bands: 80 and up good, 60 and up fair, below that poor. */
export function pctTone(value: number | null): "success" | "warning" | "danger" | "neutral" {
  if (value === null) return "neutral";
  if (value >= 80) return "success";
  if (value >= 60) return "warning";
  return "danger";
}
