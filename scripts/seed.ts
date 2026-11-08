/**
 * Seed the demo organization. Safe to re-run: it deletes the demo org (and its
 * demo auth users) first, then recreates everything.
 *
 *   npm run seed
 *
 * Test logins (also listed in README.md). Every account uses DEMO_PASSWORD.
 * Kiosk PINs are listed next to each employee below.
 */
import { createClient } from "@supabase/supabase-js";
import { breakPolicyFrom, planBreaks } from "../lib/labor/breaks";
import { localDate, startOfLocalDate } from "../lib/labor/time";
import { orgSettingsSchema } from "../lib/settings";
import type { Database } from "../lib/supabase/database.types";

export const DEMO_PASSWORD = "RoleCall-Demo-2026!";
export const DEMO_SLUG = "demo";
const TZ = "America/Los_Angeles";
const EMAIL_DOMAIN = "demo.rolecall.app";

type Role = Database["public"]["Enums"]["app_role"];

interface SeedEmployee {
  number: string;
  first: string;
  last: string;
  role: Role;
  pin: string;
  login: boolean;
  rate: number; // dollars per hour
  seniority: number;
  hired: string;
  exempt?: boolean;
}

/** One test login per role, plus extra drivers. */
export const EMPLOYEES: SeedEmployee[] = [
  { number: "1001", first: "Avery", last: "Admin", role: "admin", pin: "4826", login: true, rate: 32, seniority: 1, hired: "2015-03-02" },
  { number: "1002", first: "Sam", last: "Supervisor", role: "supervisor", pin: "5937", login: true, rate: 27, seniority: 2, hired: "2016-06-13" },
  { number: "1003", first: "Dana", last: "Dispatcher", role: "dispatcher", pin: "6148", login: true, rate: 22, seniority: 3, hired: "2018-01-08" },
  { number: "1004", first: "Casey", last: "Coordinator", role: "coordinator", pin: "7259", login: true, rate: 20, seniority: 4, hired: "2019-09-23" },
  { number: "2001", first: "Drew", last: "Driver", role: "driver", pin: "3816", login: true, rate: 16.5, seniority: 5, hired: "2020-02-17" },
  { number: "2002", first: "Riley", last: "Park", role: "driver", pin: "2947", login: true, rate: 17, seniority: 6, hired: "2020-11-30" },
  { number: "2003", first: "Jordan", last: "Reyes", role: "driver", pin: "8153", login: false, rate: 19, seniority: 7, hired: "2021-05-03" },
  { number: "2004", first: "Morgan", last: "Lee", role: "driver", pin: "9264", login: false, rate: 16, seniority: 8, hired: "2022-08-15" },
  { number: "2005", first: "Taylor", last: "Nguyen", role: "driver", pin: "1375", login: false, rate: 15.5, seniority: 9, hired: "2023-04-10", exempt: true },
  { number: "3001", first: "Frankie", last: "Fueler", role: "fueler", pin: "4682", login: true, rate: 16, seniority: 10, hired: "2021-07-19" },
  { number: "4001", first: "Toni", last: "Technician", role: "technician", pin: "5793", login: true, rate: 26, seniority: 11, hired: "2017-10-02" },
];

export const emailFor = (e: Pick<SeedEmployee, "first" | "role">) =>
  `${e.role === "driver" ? e.first.toLowerCase() : e.role}@${EMAIL_DOMAIN}`;

// v0 INSPECTION_CHECKLIST (lib/supabase.ts on main), same categories and order.
const CHECKLIST: [string, string, boolean][] = [
  ["Exterior", "Body damage", false],
  ["Exterior", "Mirrors intact", false],
  ["Exterior", "Windows unobstructed", false],
  ["Exterior", "Doors operate properly", true],
  ["Tires", "Adequate tread depth", true],
  ["Tires", "No visible damage", false],
  ["Tires", "Properly inflated", true],
  ["Tires", "No wheel leaks", false],
  ["Lights", "Headlights", true],
  ["Lights", "Taillights", false],
  ["Lights", "Brake lights", true],
  ["Lights", "Turn signals", true],
  ["Lights", "Hazard lights", false],
  ["Lights", "Interior lights", false],
  ["Brake Systems", "Brake pedal firm", true],
  ["Brake Systems", "Air brake gauge normal", true],
  ["Brake Systems", "No unusual brake sounds", true],
  ["Steering", "Steering wheel free play normal", true],
  ["Steering", "No pulling or wandering", true],
  ["Gauges", "Speedometer working", false],
  ["Gauges", "Fuel/charge gauge working", false],
  ["Gauges", "Temperature normal", false],
  ["Gauges", "Oil pressure normal", false],
  ["Interior", "Seats secure and undamaged", false],
  ["Interior", "Seat belts functional", false],
  ["Interior", "Handrails secure", false],
  ["Interior", "Floor clean and unobstructed", false],
  ["Passenger Ramp", "Ramp deploys/retracts properly", true],
  ["Passenger Ramp", "Ramp surface non-slip", false],
  ["Passenger Ramp", "No damage to ramp mechanism", false],
  ["Parking Brake", "Parking brake holds vehicle", true],
  ["Parking Brake", "Parking brake releases fully", true],
  ["Safety Equipment", "Fire extinguisher present and charged", true],
  ["Safety Equipment", "First aid kit present", false],
  ["Safety Equipment", "Emergency triangles present", false],
  ["Safety Equipment", "Emergency exits unobstructed", true],
  ["Mirrors", "All mirrors properly adjusted", false],
  ["Mirrors", "No cracks or obstructions", false],
];

function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`Seed failed: ${what}`);
  return value;
}

async function main() {
  const url = required(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
  const key = required(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SECRET_KEY");
  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // ---- Reset ---------------------------------------------------------------
  const { data: existing } = await db.from("organizations").select("id").eq("slug", DEMO_SLUG).maybeSingle();
  if (existing) {
    const { error } = await db.from("organizations").delete().eq("id", existing.id);
    if (error) throw error;
  }
  for (let page = 1; page < 20; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    for (const u of users) if (u.email?.endsWith(`@${EMAIL_DOMAIN}`)) await db.auth.admin.deleteUser(u.id);
    if (users.length < 200) break;
  }

  // ---- Organization --------------------------------------------------------
  const settings = orgSettingsSchema.parse({});
  const org = required(
    (
      await db
        .from("organizations")
        .insert({ name: "Silver State Shuttle (Demo)", slug: DEMO_SLUG, timezone: TZ, settings })
        .select()
        .single()
    ).data,
    "organization",
  );
  const orgId = org.id;
  console.log(`Organization ${org.name} (${orgId})`);

  // ---- People --------------------------------------------------------------
  const ids: Record<string, string> = {};
  for (const e of EMPLOYEES) {
    let userId: string | null = null;
    if (e.login) {
      const { data, error } = await db.auth.admin.createUser({
        email: emailFor(e),
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { name: `${e.first} ${e.last}` },
      });
      if (error) throw error;
      userId = data.user.id;
    }
    const emp = required(
      (
        await db
          .from("employees")
          .insert({
            organization_id: orgId,
            user_id: userId,
            employee_number: e.number,
            first_name: e.first,
            last_name: e.last,
            email: e.login ? emailFor(e) : null,
            role: e.role,
            hire_date: e.hired,
            seniority_number: e.seniority,
            job_title: e.role[0].toUpperCase() + e.role.slice(1),
          })
          .select("id")
          .single()
      ).data,
      `employee ${e.number}`,
    );
    ids[e.number] = emp.id;
    await db
      .from("employee_compensation")
      .update({ pay_rate_cents: Math.round(e.rate * 100), daily_ot_exempt: Boolean(e.exempt), ot_exempt_reason: e.exempt ? "4x10 schedule agreement" : null })
      .eq("employee_id", emp.id);
    const { error: pinError } = await db.rpc("set_employee_pin", { p_employee_id: emp.id, p_pin: e.pin });
    if (pinError) throw pinError;
  }
  console.log(`${EMPLOYEES.length} employees`);

  // ---- Reference data ------------------------------------------------------
  const locs = required(
    (
      await db
        .from("locations")
        .insert([
          // v0 counting-sheet columns, in v0 order: RAC, T1, T3, Term 1, Term 3 West, Term 3 East.
          { organization_id: orgId, name: "RAC", code: "RAC", kind: "rental_car", lat: 36.0590, lng: -115.1580, is_count_column: true, sort: 1 },
          { organization_id: orgId, name: "T1", code: "T1", kind: "terminal", lat: 36.0840, lng: -115.1537, is_count_column: true, sort: 2 },
          { organization_id: orgId, name: "T3", code: "T3", kind: "terminal", lat: 36.0797, lng: -115.1465, is_count_column: true, sort: 3 },
          { organization_id: orgId, name: "Term 1", code: "TERM1", kind: "terminal", lat: 36.0835, lng: -115.1525, is_count_column: true, sort: 4 },
          { organization_id: orgId, name: "Term 3 West", code: "T3W", kind: "terminal", lat: 36.0797, lng: -115.1480, is_count_column: true, sort: 5 },
          { organization_id: orgId, name: "Term 3 East", code: "T3E", kind: "terminal", lat: 36.0797, lng: -115.1450, is_count_column: true, sort: 6 },
          { organization_id: orgId, name: "Employee Lot", code: "LOT", kind: "stop", lat: 36.0700, lng: -115.1700, is_count_column: false, sort: 7 },
          { organization_id: orgId, name: "Bus Depot", code: "DEPOT", kind: "depot", lat: 36.0650, lng: -115.1750, is_count_column: false, sort: 8 },
        ])
        .select("id, code")
    ).data,
    "locations",
  );
  const loc = Object.fromEntries(locs.map((l) => [l.code, l.id]));

  const routes = required(
    (
      await db
        .from("routes")
        .insert([
          { organization_id: orgId, name: "Terminal loop", color: "#095FFC", stop_ids: [loc.T1, loc.T3] },
          { organization_id: orgId, name: "Rental car shuttle", color: "#F5A524", stop_ids: [loc.T1, loc.RAC, loc.T3] },
          { organization_id: orgId, name: "Employee lot", color: "#13804B", stop_ids: [loc.LOT, loc.T1, loc.T3] },
        ])
        .select("id, name")
    ).data,
    "routes",
  );

  const vehicles = required(
    (
      await db
        .from("vehicles")
        .insert(
          Array.from({ length: 10 }, (_, i) => ({
            organization_id: orgId,
            number: String(101 + i),
            vehicle_type: i < 8 ? "bus" : "van",
            powertrain: i % 3 === 0 ? ("ev" as const) : ("diesel" as const),
            status: (["ready", "ready", "ready", "ready", "ready", "needs_fuel", "charging", "repair", "ready", "needs_wash"] as const)[i],
            energy_level: [92, 80, 75, 64, 88, 18, 35, 60, 70, 55][i],
            odometer: 40000 + i * 3217,
            capacity: i < 8 ? 40 : 12,
          })),
        )
        .select("id, number")
    ).data,
    "vehicles",
  );
  const veh = Object.fromEntries(vehicles.map((v) => [v.number, v.id]));

  await db.from("tablets").insert(Array.from({ length: 6 }, (_, i) => ({ organization_id: orgId, number: `T-0${i + 1}` })));

  // v0 radio codes (lib/constants/radio-codes.ts + driver actions on main): 4 driver buttons, 2 board-only codes.
  // Every row lists every column: a bulk insert with differing keys sends nulls for the missing ones.
  const radio = await db.from("radio_codes").insert([
    { organization_id: orgId, code: "10-8", label: "In Service", sets_vehicle_status: "in_service", notify_roles: ["dispatcher"], is_alert: false, driver_selectable: true, sort: 1 },
    { organization_id: orgId, code: "10-39", label: "On Break", sets_vehicle_status: "in_service", notify_roles: ["dispatcher", "supervisor"], is_alert: false, driver_selectable: true, sort: 2 },
    { organization_id: orgId, code: "10-37", label: "Fueling/Wash", sets_vehicle_status: "needs_fuel", notify_roles: ["dispatcher", "admin", "supervisor"], is_alert: false, driver_selectable: true, sort: 3 },
    { organization_id: orgId, code: "10-7", label: "Out of Service", sets_vehicle_status: "shop", notify_roles: ["dispatcher", "admin"], is_alert: false, driver_selectable: true, sort: 4 },
    { organization_id: orgId, code: "10-51", label: "Assist Needed", sets_vehicle_status: null, notify_roles: ["dispatcher"], is_alert: true, driver_selectable: false, sort: 5 },
    { organization_id: orgId, code: "10-33", label: "HAZARD", sets_vehicle_status: "safety_hold", notify_roles: ["dispatcher", "supervisor"], is_alert: true, driver_selectable: false, sort: 6 },
  ]);
  if (radio.error) throw radio.error;

  await db.from("checklist_items").insert(
    CHECKLIST.map(([category, label, critical], i) => ({ organization_id: orgId, category, label, critical, sort: i })),
  );

  // v0 airline list (seeded in the v0 migrations).
  await db.from("airlines").insert([
    { organization_id: orgId, name: "Southwest Airlines", iata_code: "WN", location_id: loc.T1, phone: "1-800-435-9792", notes: "Main carrier at T1" },
    { organization_id: orgId, name: "Delta Air Lines", iata_code: "DL", location_id: loc.T1, phone: "1-800-221-1212", notes: null },
    { organization_id: orgId, name: "American Airlines", iata_code: "AA", location_id: loc.T1, phone: "1-800-433-7300", notes: null },
    { organization_id: orgId, name: "United Airlines", iata_code: "UA", location_id: loc.T3, phone: "1-800-864-8331", notes: null },
    { organization_id: orgId, name: "Spirit Airlines", iata_code: "NK", location_id: loc.T1, phone: "1-800-772-7117", notes: null },
    { organization_id: orgId, name: "Frontier Airlines", iata_code: "F9", location_id: loc.T1, phone: "1-801-401-9000", notes: null },
    { organization_id: orgId, name: "Alaska Airlines", iata_code: "AS", location_id: loc.T1, phone: "1-800-252-7522", notes: null },
    { organization_id: orgId, name: "JetBlue Airways", iata_code: "B6", location_id: loc.T3, phone: "1-800-538-2583", notes: null },
    { organization_id: orgId, name: "Hawaiian Airlines", iata_code: "HA", location_id: loc.T3, phone: "1-800-367-5320", notes: null },
    { organization_id: orgId, name: "Korean Air", iata_code: "KE", location_id: loc.T3, phone: "1-800-438-5000", notes: "International" },
    { organization_id: orgId, name: "British Airways", iata_code: "BA", location_id: loc.T3, phone: "1-800-247-9297", notes: "International" },
    { organization_id: orgId, name: "Air Canada", iata_code: "AC", location_id: loc.T3, phone: "1-888-247-2262", notes: "International" },
    { organization_id: orgId, name: "WestJet", iata_code: "WS", location_id: loc.T3, phone: "1-888-937-8538", notes: "International" },
    { organization_id: orgId, name: "Allegiant Air", iata_code: "G4", location_id: loc.T1, phone: "1-702-505-8888", notes: null },
    { organization_id: orgId, name: "Avelo Airlines", iata_code: "XP", location_id: loc.T1, phone: "1-346-616-9500", notes: null },
    { organization_id: orgId, name: "Sun Country Airlines", iata_code: "SY", location_id: loc.T1, phone: "1-651-905-2737", notes: null },
  ]);

  await db.from("chat_rooms").insert([
    { organization_id: orgId, name: "Dispatch desk", kind: "role", roles: ["admin", "supervisor", "dispatcher", "coordinator"] },
    { organization_id: orgId, name: "All drivers", kind: "role", roles: ["driver", "dispatcher", "supervisor", "admin"] },
    { organization_id: orgId, name: "Fuel and shop", kind: "role", roles: ["fueler", "technician", "dispatcher", "supervisor"] },
    { organization_id: orgId, name: "Supervisors", kind: "role", roles: ["admin", "supervisor"] },
  ]);

  await db.from("announcements").insert({
    organization_id: orgId,
    kind: "overtime",
    message: "Overtime available this weekend. Bid in Requests → Overtime.",
    created_by: ids["1003"],
  });

  // ---- Shift history (last 7 days) ------------------------------------------
  const now = new Date();
  const plan = (start: Date, minutes: number) =>
    planBreaks(start, minutes, breakPolicyFrom(settings.breaks));
  const history: { emp: string; vehicle?: string; route?: string; daysAgo: number; startHour: number; minutes: number }[] = [];
  const drivers = ["2001", "2002", "2003", "2004", "2005"];
  for (let d = 7; d >= 1; d--) {
    drivers.forEach((num, i) => {
      if ((d + i) % 6 === 0) return; // a day off now and then
      history.push({ emp: num, vehicle: String(101 + i), route: routes[i % routes.length].id, daysAgo: d, startHour: 5 + (i % 3), minutes: i === 2 ? 600 : 510 });
    });
    history.push({ emp: "3001", daysAgo: d, startHour: 6, minutes: 480 });
    history.push({ emp: "1003", daysAgo: d, startHour: 5, minutes: 510 });
  }
  for (const h of history) {
    const date = localDate(new Date(now.getTime() - h.daysAgo * 86_400_000), TZ);
    const start = new Date(startOfLocalDate(date, TZ).getTime() + h.startHour * 3_600_000);
    const end = new Date(start.getTime() + h.minutes * 60_000);
    const { data: shift, error } = await db
      .from("shifts")
      .insert({
        organization_id: orgId,
        employee_id: ids[h.emp],
        work_date: localDate(start, TZ),
        clock_in_at: start.toISOString(),
        clock_out_at: end.toISOString(),
        status: "completed",
        source_in: "kiosk",
        source_out: "kiosk",
        vehicle_id: h.vehicle ? veh[h.vehicle] : null,
        route_id: h.route ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    const breaks = plan(start, h.minutes).map((b, idx) => {
      // Mostly taken on time; the occasional missed break for the compliance view.
      const missed = (h.daysAgo + idx) % 9 === 0;
      const taken = new Date(b.windowStart.getTime() + 10 * 60_000);
      return {
        organization_id: orgId,
        shift_id: shift.id,
        employee_id: ids[h.emp],
        kind: b.kind,
        paid: b.paid,
        sequence: b.sequence,
        planned_minutes: b.plannedMinutes,
        window_start: b.windowStart.toISOString(),
        window_end: b.windowEnd.toISOString(),
        started_at: missed ? null : taken.toISOString(),
        ended_at: missed ? null : new Date(taken.getTime() + b.plannedMinutes * 60_000).toISOString(),
        status: missed ? ("missed" as const) : ("completed" as const),
      };
    });
    if (breaks.length) {
      const { error: bErr } = await db.from("breaks").insert(breaks);
      if (bErr) throw bErr;
    }
  }
  console.log(`${history.length} past shifts`);

  // ---- Live shifts for the board (drivers 2002 and 2003 are on the clock) ----
  for (const [num, vehicle, routeIdx, hoursAgo] of [
    ["2002", "102", 0, 3],
    ["2003", "103", 1, 5],
  ] as const) {
    const start = new Date(now.getTime() - hoursAgo * 3_600_000);
    const { data: shift, error } = await db
      .from("shifts")
      .insert({
        organization_id: orgId,
        employee_id: ids[num],
        work_date: localDate(start, TZ),
        clock_in_at: start.toISOString(),
        status: "active",
        vehicle_id: veh[vehicle],
        route_id: routes[routeIdx].id,
        radio_status: "10-8",
        radio_status_at: start.toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    await db.from("vehicles").update({ status: "in_service" }).eq("id", veh[vehicle]);
    await db.from("breaks").insert(
      plan(start, settings.breaks.defaultShiftMinutes).map((b) => ({
        organization_id: orgId,
        shift_id: shift.id,
        employee_id: ids[num],
        kind: b.kind,
        paid: b.paid,
        sequence: b.sequence,
        planned_minutes: b.plannedMinutes,
        window_start: b.windowStart.toISOString(),
        window_end: b.windowEnd.toISOString(),
      })),
    );
    await db.from("vehicle_positions").insert({
      organization_id: orgId,
      vehicle_id: veh[vehicle],
      employee_id: ids[num],
      shift_id: shift.id,
      lat: routeIdx === 0 ? 36.0822 : 36.0612,
      lng: routeIdx === 0 ? -115.1502 : -115.1569,
      speed_mps: 8.5,
      heading: 90,
      accuracy_m: 8,
    });
  }

  // ---- Fleet records ---------------------------------------------------------
  const defects = await db.from("defects").insert([
    { organization_id: orgId, vehicle_id: veh["108"], reported_by: ids["2004"], category: "Brakes", item: "Service brake", description: "Brakes feel soft at low speed.", severity: "critical", status: "in_progress", assigned_to: ids["4001"] },
    { organization_id: orgId, vehicle_id: veh["104"], reported_by: ids["2001"], category: "Interior", item: "Handrails", description: "Rear handrail loose.", severity: "minor", status: "open", assigned_to: null },
  ]);
  if (defects.error) throw defects.error;
  await db.from("fuel_logs").insert([
    { organization_id: orgId, vehicle_id: veh["102"], employee_id: ids["3001"], service: "fuel", energy_before: 30, energy_after: 100, quantity: 41.5 },
    { organization_id: orgId, vehicle_id: veh["104"], employee_id: ids["3001"], service: "charge", energy_before: 22, energy_after: 90, quantity: 160 },
  ]);

  // ---- Scheduling ------------------------------------------------------------
  const day = 86_400_000;
  const cycle = required(
    (
      await db
        .from("bid_cycles")
        .insert({
          organization_id: orgId,
          name: "Winter 2027 shift bid",
          description: "Lines for January through April 2027. Higher seniority is awarded first.",
          starts_on: "2027-01-03",
          ends_on: "2027-04-24",
          opens_at: new Date(now.getTime() - day).toISOString(),
          closes_at: new Date(now.getTime() + 10 * day).toISOString(),
          status: "open",
          created_by: ids["1001"],
        })
        .select("id")
        .single()
    ).data,
    "bid cycle",
  );
  await db.from("bid_lines").insert(
    [
      ["04:30", "13:00", [1, 2, 3, 4, 5]],
      ["05:00", "13:30", [0, 1, 2, 3, 4]],
      ["10:00", "18:30", [2, 3, 4, 5, 6]],
      ["14:00", "22:30", [1, 2, 3, 4, 5]],
      ["15:00", "23:30", [0, 1, 4, 5, 6]],
      ["22:00", "06:30", [0, 1, 2, 3, 4]],
    ].map(([start, end, days], i) => ({
      organization_id: orgId,
      cycle_id: cycle.id,
      line_number: i + 1,
      start_time: start as string,
      end_time: end as string,
      weekdays: days as number[],
      capacity: i < 2 ? 2 : 1,
      route_id: routes[i % routes.length].id,
    })),
  );
  await db.from("ot_offers").insert([
    { organization_id: orgId, starts_at: new Date(now.getTime() + 2 * day).toISOString(), duration_minutes: 480, slots: 2, description: "Saturday terminal loop coverage", bid_closes_at: new Date(now.getTime() + day).toISOString(), posted_by: ids["1003"] },
    { organization_id: orgId, starts_at: new Date(now.getTime() + 3 * day).toISOString(), duration_minutes: 300, slots: 1, description: "Sunday rental car shuttle, morning", bid_closes_at: new Date(now.getTime() + 2 * day).toISOString(), posted_by: ids["1003"] },
  ]);

  // ---- Safety, forms, leave ---------------------------------------------------
  await db.from("safety_meetings").insert([
    { organization_id: orgId, title: "Winter driving and wet roads", starts_at: new Date(now.getTime() + 2 * day).toISOString(), location: "Depot break room", audience: ["driver"], created_by: ids["1002"] },
    { organization_id: orgId, title: "Fueling safety refresher", starts_at: new Date(now.getTime() + 4 * day).toISOString(), location: "Fuel island", audience: ["fueler", "technician"], created_by: ids["1002"] },
    { organization_id: orgId, title: "Monthly all-hands safety", starts_at: new Date(now.getTime() + 7 * day).toISOString(), location: "Depot break room", audience: [], created_by: ids["1002"] },
  ]);
  await db.from("leave_ledger").insert(
    ["2001", "2002", "2003", "2004", "2005", "3001", "4001"].flatMap((n) => [
      { organization_id: orgId, employee_id: ids[n], kind: "pto", hours: 40, reason: "Opening balance", created_by: ids["1001"] },
      { organization_id: orgId, employee_id: ids[n], kind: "vacation", hours: 80, reason: "Opening balance", created_by: ids["1001"] },
      { organization_id: orgId, employee_id: ids[n], kind: "sick", hours: 24, reason: "Opening balance", created_by: ids["1001"] },
    ]),
  );
  await db.from("form_submissions").insert({
    organization_id: orgId,
    employee_id: ids["2002"],
    form_type: "time_off",
    payload: { start_date: new Date(now.getTime() + 14 * day).toISOString().slice(0, 10), end_date: new Date(now.getTime() + 15 * day).toISOString().slice(0, 10), hours: 16, leave_kind: "pto", reason: "Family event" },
  });

  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
