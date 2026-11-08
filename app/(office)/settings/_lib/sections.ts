/**
 * Organization settings sections. Each section edits one key of
 * organizations.settings (see orgSettingsSchema in lib/settings.ts). Plain data,
 * shared by the pages (server) and the form (client).
 */
export type SettingField =
  | {
      key: string;
      label: string;
      type: "number";
      hint?: string;
      min?: number;
      max?: number;
      step?: number;
      /** Stored value = shown value x scale (for example hours shown, minutes stored). */
      scale?: number;
    }
  | { key: string; label: string; type: "boolean"; hint?: string }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; hint?: string };

export interface SettingsSection {
  /** URL segment and settings key (labor, breaks...). */
  slug: string;
  navLabel: string;
  title: string;
  description: string;
  fields: SettingField[];
  note?: string;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    slug: "labor",
    navLabel: "Labor rules",
    title: "Overtime rules",
    description: "Nevada rules by default. Payroll, timesheets and overtime offers all use these numbers.",
    fields: [
      { key: "dailyOvertimeMinutes", label: "Daily OT threshold (h)", type: "number", min: 1, max: 24, step: 0.25, scale: 60, hint: "Hours in a 24-hour workday before daily overtime." },
      { key: "weeklyOvertimeMinutes", label: "Weekly OT threshold (h)", type: "number", min: 1, max: 168, step: 0.5, scale: 60, hint: "Hours in a workweek before weekly overtime." },
      { key: "overtimeMultiplier", label: "OT multiplier", type: "number", min: 1, max: 3, step: 0.1 },
      { key: "dailyOvertime", label: "Apply daily overtime (NRS 608.018)", type: "boolean", hint: "Daily overtime applies only to employees paid under 1.5 times the minimum wage." },
      { key: "minimumWageCents", label: "State minimum wage ($ per hour)", type: "number", min: 0, step: 0.01, scale: 100, hint: "Nevada is $12.00 since 2024-07-01. Check NRS 608 before changing it." },
    ],
    note: "Weekly overtime is counted per workweek. Set the first day of the workweek under General.",
  },
  {
    slug: "breaks",
    navLabel: "Breaks",
    title: "Break rules",
    description: "Read by the break planner, reminders and compliance checks.",
    fields: [
      { key: "restMinutes", label: "Break duration (min)", type: "number", min: 10, max: 60, step: 1, hint: "Paid rest break. Nevada requires 10 minutes per 4 hours worked." },
      { key: "windowMinutes", label: "Flex window (min)", type: "number", min: 15, max: 180, step: 1, hint: "How long each planned break stays open." },
      { key: "defaultShiftMinutes", label: "Default shift length (min)", type: "number", min: 60, max: 960, step: 15, hint: "Used to plan breaks when a shift has no scheduled end." },
      { key: "reminderGraceMinutes", label: "Overstay reminder (min)", type: "number", min: 0, max: 30, step: 1, hint: "Reminder is sent this long after a break window opens." },
      { key: "overrunGraceMinutes", label: "Overstay alert (min)", type: "number", min: 1, max: 60, step: 1, hint: "Alert dispatch when a break runs this far over." },
      { key: "mealMinutes", label: "Meal break duration (min)", type: "number", min: 30, max: 120, step: 5, hint: "Unpaid meal for shifts of 8 hours or more (NRS 608.019)." },
      { key: "reopenWindowMinutes", label: "Dispatcher re-open window (min)", type: "number", min: 5, max: 180, step: 5, hint: "How long a missed break can be re-enabled by dispatch." },
    ],
  },
  {
    slug: "fatigue",
    navLabel: "Fatigue",
    title: "Fatigue rules",
    description: "Alerts are raised for dispatch and supervisors when someone passes a limit.",
    fields: [
      { key: "warnShiftHours", label: "Warn at shift length (h)", type: "number", min: 4, max: 24, step: 0.5 },
      { key: "maxShiftHours", label: "Maximum shift length (h)", type: "number", min: 4, max: 24, step: 0.5 },
      { key: "maxOnDutyHours", label: "Maximum on-duty hours", type: "number", min: 4, max: 24, step: 0.5, hint: "FMCSA passenger carriers: no driving after 15 hours on duty." },
      { key: "minRestHours", label: "Minimum rest between shifts (h)", type: "number", min: 4, max: 24, step: 0.5, hint: "FMCSA passenger carriers: 8 consecutive hours off duty." },
      { key: "warnConsecutiveDays", label: "Warn after consecutive days", type: "number", min: 2, max: 14, step: 1 },
      { key: "maxWeeklyHours", label: "Maximum weekly hours", type: "number", min: 20, max: 100, step: 1, hint: "FMCSA: 60 hours in 7 days. Also used to flag overtime bidders." },
      { key: "weeklyOvertimeWarnHours", label: "Weekly OT warning (h)", type: "number", min: 1, max: 60, step: 0.5 },
    ],
  },
  {
    slug: "assist",
    navLabel: "Assist",
    title: "Assist requests",
    description: "Wheelchair and special-assist requests escalate when nobody responds.",
    fields: [
      { key: "escalationMinutes", label: "Escalate unanswered requests after (min)", type: "number", min: 1, max: 60, step: 1 },
    ],
  },
  {
    slug: "notifications",
    navLabel: "Notifications",
    title: "Email notifications",
    description: "In-app notifications are always on. Email is optional.",
    fields: [
      { key: "email", label: "Send important notifications by email", type: "boolean", hint: "Needs a verified sending domain in the email provider. Until then, messages may not be delivered." },
    ],
    note: "Email notifications need a verified sending domain. Ask whoever manages DNS for the domain to verify it before turning this on.",
  },
  {
    slug: "gps",
    navLabel: "GPS",
    title: "GPS tracking",
    description: "Phones report position while a driver is on shift with a vehicle assigned.",
    fields: [
      { key: "intervalSeconds", label: "Report position every (seconds)", type: "number", min: 5, max: 120, step: 1 },
      { key: "retentionDays", label: "Keep position history (days)", type: "number", min: 1, max: 365, step: 1 },
    ],
  },
  {
    slug: "readiness",
    navLabel: "Readiness",
    title: "Fleet readiness",
    description: "When a vehicle shows as low on fuel or charge.",
    fields: [
      { key: "lowFuelPercent", label: "Low fuel at or below (%)", type: "number", min: 0, max: 100, step: 1 },
      { key: "evChargePercent", label: "EV needs charge at or below (%)", type: "number", min: 0, max: 100, step: 1 },
    ],
  },
  {
    slug: "kiosk",
    navLabel: "Kiosk options",
    title: "Kiosk options",
    description: "Apply to every paired time clock kiosk.",
    fields: [
      { key: "maxPinAttempts", label: "Wrong PIN attempts before lockout", type: "number", min: 3, max: 10, step: 1 },
      { key: "lockoutMinutes", label: "Lockout length (min)", type: "number", min: 1, max: 120, step: 1 },
      { key: "idleResetSeconds", label: "Reset to the start screen after (seconds)", type: "number", min: 4, max: 60, step: 1 },
      { key: "theme", label: "Kiosk theme", type: "select", options: [{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }] },
    ],
  },
];

export const SECTION_BY_SLUG = new Map(SETTINGS_SECTIONS.map((s) => [s.slug, s]));
