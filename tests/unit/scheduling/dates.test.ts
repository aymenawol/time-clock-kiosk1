import { describe, expect, it } from "vitest";
import {
  addDaysYmd,
  fmtClockTime,
  fromZonedInput,
  isValidTimeZone,
  toZonedInput,
  weekdaysLabel,
} from "@/lib/scheduling/datetime";
import { lockPayload, payrollCsvRows, periodDatesProblem, suggestNextPeriod } from "@/lib/scheduling/pay-periods";

const TZ = "America/Los_Angeles";

describe("zoned datetime inputs", () => {
  it("reads a datetime-local value as wall time in the org time zone", () => {
    expect(fromZonedInput("2026-11-07T14:30", TZ).toISOString()).toBe("2026-11-07T22:30:00.000Z");
    expect(fromZonedInput("2026-07-01T06:00", TZ).toISOString()).toBe("2026-07-01T13:00:00.000Z");
  });

  it("round trips across a DST change", () => {
    const iso = fromZonedInput("2026-03-08T09:15", TZ).toISOString();
    expect(iso).toBe("2026-03-08T16:15:00.000Z");
    expect(toZonedInput(iso, TZ)).toBe("2026-03-08T09:15");
  });

  it("rejects malformed input", () => {
    expect(() => fromZonedInput("2026-11-07", TZ)).toThrow();
  });

  it("validates time zones", () => {
    expect(isValidTimeZone("America/Phoenix")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("small formatters", () => {
  it("adds calendar days across month ends", () => {
    expect(addDaysYmd("2026-12-25", 13)).toBe("2027-01-07");
  });
  it("labels weekdays", () => {
    expect(weekdaysLabel([1, 2, 3, 4, 5])).toBe("Mo Tu We Th Fr");
    expect(weekdaysLabel([0, 1, 2, 3, 4, 5, 6])).toBe("Every day");
  });
  it("formats Postgres times", () => {
    expect(fmtClockTime("05:30:00")).toBe("5:30 AM");
    expect(fmtClockTime("00:05:00")).toBe("12:05 AM");
    expect(fmtClockTime("17:45:00", true)).toBe("17:45");
  });
});

describe("pay periods", () => {
  it("suggests the next 14-day period after the last one", () => {
    expect(suggestNextPeriod("2026-11-14", "2026-11-01")).toEqual({
      startsOn: "2026-11-15",
      endsOn: "2026-11-28",
      payDate: "2026-12-03",
    });
  });
  it("starts at the current workweek when there is no period yet", () => {
    expect(suggestNextPeriod(null, "2026-11-01").startsOn).toBe("2026-11-01");
  });
  it("explains invalid dates", () => {
    expect(periodDatesProblem("2026-11-15", "2026-11-28", "2026-12-03")).toBeNull();
    expect(periodDatesProblem("2026-11-15", "2026-11-01", null)).toMatch(/end date/);
    expect(periodDatesProblem("2026-11-01", "2026-12-15", null)).toMatch(/at most/);
    expect(periodDatesProblem("2026-11-15", "2026-11-28", "2026-11-01")).toMatch(/pay date/);
  });

  const line = {
    employee_id: "e1",
    employee_number: "2001",
    name: "=cmd",
    regular_minutes: 4800,
    daily_ot_minutes: 30,
    weekly_ot_minutes: 60,
    paid_break_minutes: 150,
    unpaid_break_minutes: 300,
    leave_minutes: 0,
    pay_rate_cents: 1650,
    regular_cents: 132000,
    overtime_cents: 2228,
    gross_cents: 134228,
    detail: { shifts: 10, openShifts: 0, dailyOvertimeApplies: true },
  };

  it("strips names before locking", () => {
    const [payload] = lockPayload([line]);
    expect(payload).not.toHaveProperty("name");
    expect(payload).not.toHaveProperty("employee_number");
    expect(payload.gross_cents).toBe(134228);
  });

  it("builds CSV rows with hours and dollars", () => {
    const rows = payrollCsvRows([line]);
    expect(rows[0][0]).toBe("Employee number");
    expect(rows[1]).toEqual(["2001", "=cmd", 80, 0.5, 1, 1.5, 2.5, 5, 0, "16.50", "1320.00", "22.28", "1342.28"]);
  });
});
