import { z } from "zod";

/** Employee request types and their validated payloads (form_submissions.payload). */
export const FORM_TYPES = ["time_off", "bid_vacation_change", "incident_report", "fmla_conversion", "resignation"] as const;
export type FormType = (typeof FORM_TYPES)[number];

export const LEAVE_KINDS = ["pto", "vacation", "sick", "fmla"] as const;
export type LeaveKind = (typeof LEAVE_KINDS)[number];
export const LEAVE_LABEL: Record<LeaveKind, string> = { pto: "PTO", vacation: "Vacation", sick: "Sick", fmla: "FMLA" };

const date = z.iso.date("Pick a date");
const text = (max: number, min = 1) => z.string().trim().min(min, "Required").max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();

const range = <T extends { start_date: string; end_date: string }>(v: T) => v.end_date >= v.start_date;

export const formSchemas = {
  time_off: z
    .object({
      start_date: date,
      end_date: date,
      hours: z.coerce.number().positive("Enter the hours").max(400),
      leave_kind: z.enum(["pto", "vacation", "sick"]),
      reason: optionalText(1000),
    })
    .refine(range, { message: "End date must be on or after the start date", path: ["end_date"] }),
  bid_vacation_change: z.object({
    current: text(200),
    requested: text(200),
    reason: text(1000),
  }),
  incident_report: z.object({
    occurred_at: z.iso.datetime({ local: true, message: "Enter when it happened" }),
    location: text(200),
    vehicle_number: optionalText(20),
    description: text(4000, 10),
    injuries: z.enum(["no", "yes"]),
    injury_details: optionalText(2000),
    witnesses: optionalText(1000),
    police_report: optionalText(100),
  }),
  fmla_conversion: z
    .object({
      start_date: date,
      end_date: date,
      hours: z.coerce.number().positive().max(480),
      reason: text(1000),
    })
    .refine(range, { message: "End date must be on or after the start date", path: ["end_date"] }),
  resignation: z.object({
    last_day: date,
    reason: optionalText(2000),
  }),
} satisfies Record<FormType, z.ZodType>;

export type FormPayload<T extends FormType> = z.infer<(typeof formSchemas)[T]>;

export const FORM_META: Record<FormType, { label: string; description: string }> = {
  time_off: { label: "Time off", description: "Use PTO, vacation or sick hours." },
  bid_vacation_change: { label: "Bid or vacation change", description: "Ask to change your bid line or vacation dates." },
  incident_report: { label: "Incident report", description: "Report an accident, injury or safety incident." },
  fmla_conversion: { label: "FMLA conversion", description: "Convert time away to FMLA leave." },
  resignation: { label: "Resignation", description: "Give notice of your last day." },
};

export const FORM_STATUS: Record<string, { label: string; tone: "neutral" | "primary" | "success" | "warning" | "danger" }> = {
  submitted: { label: "Waiting for review", tone: "primary" },
  approved: { label: "Approved", tone: "success" },
  denied: { label: "Denied", tone: "danger" },
  returned: { label: "Returned for changes", tone: "warning" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

/** Leave to deduct when a request is approved, if any. */
export function leaveDeduction(type: string, payload: unknown): { kind: LeaveKind; hours: number } | null {
  if (type === "time_off") {
    const p = formSchemas.time_off.safeParse(payload);
    return p.success ? { kind: p.data.leave_kind, hours: p.data.hours } : null;
  }
  if (type === "fmla_conversion") {
    const p = formSchemas.fmla_conversion.safeParse(payload);
    return p.success ? { kind: "fmla", hours: p.data.hours } : null;
  }
  return null;
}

/** Human-readable label/value pairs for displaying a payload. */
export function describePayload(payload: Record<string, unknown>): { label: string; value: string }[] {
  const labels: Record<string, string> = {
    start_date: "Start date",
    end_date: "End date",
    hours: "Hours",
    leave_kind: "Leave type",
    reason: "Reason",
    current: "Current",
    requested: "Requested",
    occurred_at: "When",
    location: "Where",
    vehicle_number: "Vehicle",
    description: "What happened",
    injuries: "Injuries",
    injury_details: "Injury details",
    witnesses: "Witnesses",
    police_report: "Police report number",
    last_day: "Last day",
  };
  return Object.entries(payload)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => ({
      label: labels[k] ?? k,
      value: k === "leave_kind" && typeof v === "string" ? (LEAVE_LABEL[v as LeaveKind] ?? v) : String(v),
    }));
}
