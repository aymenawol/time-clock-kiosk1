import { describe, expect, it } from "vitest";
import {
  type CountRowLike,
  breakWindowLabel,
  columnSums,
  entryRowCount,
  fmtPaperTime,
  formatBreakWindows,
  headerCells,
  lastFirst,
  parseCount,
  resolveSlotStart,
  sheetLayout,
  stampLabel,
  timeInputValue,
  toSheetColumn,
} from "@/lib/counts/sheet";

const TZ = "America/Los_Angeles";
const loc = (id: string, name: string, group: string | null, label: string | null) =>
  toSheetColumn({ id, name, count_group: group, count_label: label });
const cols = [
  loc("a", "T1", "RAC", "T-1"),
  loc("b", "T3", "RAC", "T-3"),
  loc("c", "Term 1", null, "TERM 1"),
  loc("d", "Term 3 West", "TERM 3", "West"),
  loc("e", "Term 3 East", "TERM 3", "East"),
];

describe("columns", () => {
  it("uses the label, falling back to the name", () => {
    expect(cols.map((c) => c.heading)).toEqual(["RAC T-1", "RAC T-3", "TERM 1", "TERM 3 West", "TERM 3 East"]);
    expect(loc("x", "Gate 4", null, null).heading).toBe("Gate 4");
  });
  it("groups adjacent columns only", () => {
    const h = headerCells(cols);
    expect(h.map((c) => (c.kind === "group" ? `${c.label}:${c.columns.length}` : c.column.label))).toEqual([
      "RAC:2",
      "TERM 1",
      "TERM 3:2",
    ]);
    expect(headerCells([cols[0], cols[2], cols[1]])).toHaveLength(3);
  });
});

describe("layout", () => {
  it("is 21 rows with a subtotal after each block but the last", () => {
    const items = sheetLayout(21);
    expect(items.filter((i) => i.type === "entry")).toHaveLength(21);
    expect(items.filter((i) => i.type === "subtotal")).toHaveLength(6);
    expect(items.at(-1)?.type).toBe("entry");
    expect(items[3]).toEqual({ type: "subtotal", from: 0, to: 2, block: 1 });
  });
  it("grows in blocks of 3", () => {
    expect(entryRowCount(0)).toBe(21);
    expect(entryRowCount(21)).toBe(21);
    expect(entryRowCount(22)).toBe(24);
    expect(sheetLayout(24).filter((i) => i.type === "subtotal")).toHaveLength(7);
  });
  it("sums per column", () => {
    const rows: CountRowLike[] = [{ counts: { a: 2, b: 3 } }, { counts: { a: 1 } }, { counts: { c: 5 } }, { counts: { a: 10 } }];
    expect(columnSums(rows, ["a", "b", "c"], 0, 2)).toEqual({ a: 3, b: 3, c: 5 });
    expect(columnSums(rows, ["a", "b", "c"])).toEqual({ a: 13, b: 3, c: 5 });
  });
  it("parses counts", () => {
    expect(parseCount("12a3")).toBe(123);
    expect(parseCount("12345")).toBe(123);
    expect(parseCount("")).toBe(0);
  });
});

describe("header box", () => {
  it("formats names, times and the stamp", () => {
    expect(lastFirst({ first_name: "Ada", last_name: "Lovelace" })).toBe("Lovelace, Ada");
    const d = "2026-11-12T11:53:00Z"; // 03:53 PST
    expect(fmtPaperTime(d, TZ)).toBe("3:53");
    expect(fmtPaperTime("2026-11-12T20:00:00Z", TZ)).toBe("12:00");
    // 24-hour like the paper, whatever the org display setting.
    expect(fmtPaperTime("2026-11-13T02:15:00Z", TZ)).toBe("18:15");
    expect(stampLabel("2026-11-13T05:21:00Z", TZ)).toBe("NOV 12 21:21");
    expect(fmtPaperTime(null, TZ)).toBe("");
    expect(stampLabel(d, TZ)).toBe("NOV 12 3:53");
  });
  it("formats break windows in sequence order, rest only", () => {
    const b = (kind: string, sequence: number, start: string | null, mins = 15) => ({
      kind,
      sequence,
      planned_minutes: mins,
      window_start: start,
    });
    expect(breakWindowLabel("2026-11-12T14:15:00Z", 15, TZ)).toBe("06:15-06:30");
    expect(
      formatBreakWindows(
        [
          b("rest", 2, "2026-11-12T17:45:00Z"),
          b("meal", 3, "2026-11-12T20:00:00Z", 30),
          b("rest", 1, "2026-11-12T14:15:00Z"),
          b("rest", 4, null),
        ],
        TZ,
      ),
    ).toBe("06:15-06:30 / 09:45-10:00");
    expect(formatBreakWindows([], TZ)).toBe("");
  });
});

describe("resolveSlotStart", () => {
  it("uses the clock-in date, or the next day for night shifts", () => {
    const day = resolveSlotStart("2026-11-12T12:00:00Z", "09:45", TZ); // clock-in 04:00 PST
    expect(timeInputValue(day, TZ)).toBe("09:45");
    expect(day.toISOString()).toBe("2026-11-12T17:45:00.000Z");
    const night = resolveSlotStart("2026-11-13T06:00:00Z", "01:30", TZ); // clock-in 22:00 PST on the 12th
    expect(night.toISOString()).toBe("2026-11-13T09:30:00.000Z");
  });
});
