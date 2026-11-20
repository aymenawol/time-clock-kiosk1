import { describe, expect, it } from "vitest";
import {
  fmtWorked,
  isItemActive,
  itemsForKind,
  milesDriven,
  milesError,
  nextMark,
  parseResults,
  readMark,
  sheetFooter,
  timeWorkedMinutes,
  toSections,
  type PaperItem,
} from "@/lib/inspection";

const item = (over: Partial<PaperItem>): PaperItem => ({
  id: "i",
  category: "Vehicle Exterior Checks",
  label: "Item",
  critical: false,
  sort: 1,
  paper_column: 1,
  mini: false,
  psi: false,
  subgroup: null,
  pre_trip_only: false,
  hint: null,
  ...over,
});

describe("miles", () => {
  it("computes miles driven", () => {
    expect(milesDriven(40_000, 40_125)).toBe(125);
    expect(milesDriven(40_000, 40_000)).toBe(0);
  });
  it("is null when a reading is missing or the readings are swapped", () => {
    expect(milesDriven(null, 5)).toBeNull();
    expect(milesDriven(5, null)).toBeNull();
    expect(milesDriven(100, 50)).toBeNull();
  });
  it("flags End Miles below Beginning Miles", () => {
    expect(milesError(100, 50)).toMatch(/can't be lower/);
    expect(milesError(100, 100)).toBeNull();
    expect(milesError(null, 50)).toBeNull();
  });
});

describe("time worked", () => {
  it("is the minutes between clock-in and clock-out", () => {
    expect(timeWorkedMinutes("2026-11-19T14:00:00Z", "2026-11-19T22:05:00Z")).toBe(485);
  });
  it("is null while the shift is open or if out is before in", () => {
    expect(timeWorkedMinutes("2026-11-19T14:00:00Z", null)).toBeNull();
    expect(timeWorkedMinutes("2026-11-19T14:00:00Z", "2026-11-19T13:00:00Z")).toBeNull();
  });
  it("formats as H:MM", () => {
    expect(fmtWorked(485)).toBe("8:05");
    expect(fmtWorked(0)).toBe("0:00");
    expect(fmtWorked(null)).toBe("");
  });
});

describe("which items appear on each kind", () => {
  const items = [
    item({ id: "a" }),
    item({ id: "b", mini: true }),
    item({ id: "c", mini: true, pre_trip_only: true }),
    item({ id: "d", pre_trip_only: true }),
  ];
  it("pre-trip has every item", () => {
    expect(itemsForKind("pre_trip", items).map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("post-trip has only starred, unshaded items", () => {
    expect(itemsForKind("post_trip", items).map((i) => i.id)).toEqual(["b"]);
    expect(isItemActive("post_trip", items[2])).toBe(false);
  });
});

describe("marks and results", () => {
  it("reads the older ok form", () => {
    expect(readMark({ ok: true })).toBe("ok");
    expect(readMark({ ok: false })).toBe("x");
    expect(readMark({ mark: "na" })).toBe("na");
    expect(readMark({})).toBeNull();
  });
  it("cycles blank, OK, X, NA", () => {
    expect(nextMark(null)).toBe("ok");
    expect(nextMark("ok")).toBe("x");
    expect(nextMark("x")).toBe("na");
    expect(nextMark("na")).toBeNull();
  });
  it("parses and normalises results", () => {
    const r = parseResults([
      { item_id: "1", mark: "x", psi: 90, note: "Cracked", critical: true, label: "L", category: "C" },
      { item_id: "2", ok: true },
      { nope: true },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ mark: "x", psi: 90, note: "Cracked", critical: true });
    expect(r[1]).toMatchObject({ mark: "ok", psi: null, note: null });
  });
});

describe("layout", () => {
  it("splits sections into left and right columns in paper order", () => {
    const s = toSections([
      item({ id: "r", sort: 2, paper_column: 2 }),
      item({ id: "l", sort: 1, paper_column: 1 }),
      item({ id: "b", sort: 3, category: "Brake System Checks" }),
    ]);
    expect(s.map((x) => x.title)).toEqual(["Vehicle Exterior Checks", "Brake System Checks"]);
    expect(s[0].left.map((i) => i.id)).toEqual(["l"]);
    expect(s[0].right.map((i) => i.id)).toEqual(["r"]);
  });
  it("derives a neutral footer", () => {
    expect(sheetFooter("Bus")).toBe("DVIR · Bus");
    expect(sheetFooter(null)).toBe("DVIR");
  });
});
