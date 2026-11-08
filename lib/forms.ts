import { z } from "zod";

/** Employee request types and their validated payloads (form_submissions.payload). Field names, labels and order follow the v0 forms. */
export const FORM_TYPES = ["time_off", "bid_vacation_change", "incident_report", "fmla_conversion", "resignation"] as const;
export type FormType = (typeof FORM_TYPES)[number];

/** Leave ledger kinds (balances). */
export const LEAVE_KINDS = ["pto", "vacation", "sick", "fmla"] as const;
export type LeaveKind = (typeof LEAVE_KINDS)[number];
export const LEAVE_LABEL: Record<LeaveKind, string> = { pto: "PTO", vacation: "Vacation", sick: "Sick", fmla: "FMLA" };

export const TIME_OFF_TYPES = ["vacation", "pto", "jury_duty", "bereavement", "birthday"] as const;
export const TIME_OFF_LABEL: Record<(typeof TIME_OFF_TYPES)[number], string> = {
  vacation: "Vacation",
  pto: "PTO",
  jury_duty: "Jury Duty",
  bereavement: "Bereavement",
  birthday: "Birthday Leave",
};
export const INCIDENT_TYPES = ["vehicle_collision", "property_damage", "personal_injury", "near_miss", "passenger_incident", "other"] as const;
export const INCIDENT_LABEL: Record<(typeof INCIDENT_TYPES)[number], string> = {
  vehicle_collision: "Vehicle Collision",
  property_damage: "Property Damage",
  personal_injury: "Personal Injury",
  near_miss: "Near Miss",
  passenger_incident: "Passenger Incident",
  other: "Other",
};

const date = z.iso.date("Pick a date");
const text = (max: number, min = 1) => z.string().trim().min(min, "Required").max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const yesNo = z.enum(["yes", "no"]).optional();
const optionalDate = z.iso.date("Pick a date").optional();
const optionalNumber = z.coerce.number().nonnegative("Enter a number").max(480).optional();

const range = <T extends { start_date: string; end_date: string }>(v: T) => v.end_date >= v.start_date;

export const formSchemas = {
  time_off: z
    .object({
      start_date: date,
      end_date: date,
      leave_type: z.enum(TIME_OFF_TYPES),
      comments: optionalText(1000),
    })
    .refine(range, { message: "End date must be on or after the start date", path: ["end_date"] }),
  bid_vacation_change: z.object({
    current_assignment: text(200),
    requested_change: text(200),
    reason: text(1000),
  }),
  incident_report: z.object({
    incident_date: date,
    bus_number: optionalText(20),
    location: text(200),
    incident_type: z.enum(INCIDENT_TYPES),
    description: text(4000),
    witnesses: optionalText(1000),
    passenger_info: optionalText(1000),
    supervisor_contacted: yesNo,
    injuries_damage: optionalText(2000),
  }),
  fmla_conversion: z.object({
    leave_start_date: date,
    estimated_return_date: optionalDate,
    condition_description: text(1000),
    provider_name: optionalText(200),
    vacation_pay_usage: yesNo,
    hours_used: optionalNumber,
  }),
  resignation: z.object({
    last_day: date,
    reason: optionalText(2000),
  }),
} satisfies Record<FormType, z.ZodType>;

export type FormPayload<T extends FormType> = z.infer<(typeof formSchemas)[T]>;

export const FORM_META: Record<FormType, { label: string; description: string }> = {
  time_off: { label: "Time Off Request", description: "Request scheduled time off" },
  bid_vacation_change: { label: "Bid/Vacation Change", description: "Request a change to your bid or vacation assignment" },
  incident_report: { label: "Incident Report", description: "Report a workplace incident or near-miss" },
  fmla_conversion: { label: "FMLA Conversion", description: "Convert leave to FMLA protected status" },
  resignation: { label: "Resignation Letter", description: "Submit a formal resignation" },
};

export const FORM_STATUS: Record<string, { label: string; tone: "neutral" | "primary" | "success" | "warning" | "danger" }> = {
  submitted: { label: "Waiting for review", tone: "primary" },
  approved: { label: "Approved", tone: "success" },
  denied: { label: "Denied", tone: "danger" },
  returned: { label: "Returned for changes", tone: "warning" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

/**
 * Leave to deduct when a request is approved, if any. Time off defaults to 8 hours per calendar day
 * (v0 had no hours field); the reviewer can override the hours.
 */
export function leaveDeduction(type: string, payload: unknown): { kind: LeaveKind; hours: number } | null {
  if (type === "time_off") {
    const p = formSchemas.time_off.safeParse(payload);
    if (!p.success || (p.data.leave_type !== "pto" && p.data.leave_type !== "vacation")) return null;
    const days = Math.round((Date.parse(p.data.end_date) - Date.parse(p.data.start_date)) / 86_400_000) + 1;
    return { kind: p.data.leave_type, hours: days * 8 };
  }
  if (type === "fmla_conversion") {
    const p = formSchemas.fmla_conversion.safeParse(payload);
    return p.success && p.data.hours_used ? { kind: "fmla", hours: p.data.hours_used } : null;
  }
  return null;
}

/** Human-readable label/value pairs for displaying a payload, in the order the form was filled. */
export function describePayload(payload: Record<string, unknown>): { label: string; value: string }[] {
  const labels: Record<string, string> = {
    start_date: "Start Date",
    end_date: "End Date",
    leave_type: "Type",
    comments: "Comments",
    current_assignment: "Current Assignment / Shift",
    requested_change: "Requested Change",
    reason: "Reason",
    incident_date: "Incident Date",
    bus_number: "Bus Number",
    location: "Location / Route",
    incident_type: "Incident Type",
    description: "Description of Incident",
    witnesses: "Witnesses (if any)",
    passenger_info: "Passenger Information",
    supervisor_contacted: "Supervisor Contacted?",
    injuries_damage: "Injuries / Damage Details",
    leave_start_date: "Leave Start Date",
    estimated_return_date: "Estimated Return Date",
    condition_description: "Condition / Reason",
    provider_name: "Healthcare Provider Name",
    vacation_pay_usage: "Apply paid vacation/PTO during leave?",
    hours_used: "Estimated Hours Used",
    last_day: "Last Day of Work",
    // Submissions made before the fields were aligned with v0
    hours: "Hours",
    leave_kind: "Leave type",
    current: "Current",
    requested: "Requested",
    occurred_at: "When",
    vehicle_number: "Vehicle",
    injuries: "Injuries",
    injury_details: "Injury details",
    police_report: "Police report number",
  };
  const pretty = (k: string, v: unknown): string => {
    const s = String(v);
    if (k === "leave_type") return TIME_OFF_LABEL[s as keyof typeof TIME_OFF_LABEL] ?? s;
    if (k === "leave_kind") return LEAVE_LABEL[s as LeaveKind] ?? s;
    if (k === "incident_type") return INCIDENT_LABEL[s as keyof typeof INCIDENT_LABEL] ?? s;
    if (k === "supervisor_contacted") return s === "yes" ? "Yes" : s === "no" ? "No" : s;
    if (k === "vacation_pay_usage") return s === "yes" ? "Yes - use my vacation/PTO balance" : s === "no" ? "No - unpaid FMLA" : s;
    return s;
  };
  return Object.entries(payload)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => ({ label: labels[k] ?? k, value: pretty(k, v) }));
}
