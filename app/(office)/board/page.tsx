import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { todayIn } from "@/lib/format";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { breakState } from "@/components/ops/break-state";
import { describePosition, etaSeconds, nextStop, type Place } from "@/components/ops/geo";
import { loadActiveShifts, loadAssignOptions, loadPlaces, routeStops } from "@/components/ops/queries";
import { dayRange, serverNow } from "@/components/ops/time";
import { BoardView, type BoardData, type BoardRow } from "./_components/board-view";

export const metadata: Metadata = { title: "Dispatch board" };

const ROLE_ORDER = { driver: 0, fueler: 1, technician: 2, dispatcher: 3, coordinator: 4, supervisor: 5, admin: 6 } as const;

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ wall?: string }> }) {
  const auth = await requireAuth("board");
  const { wall } = await searchParams;
  const isWall = wall === "1";
  const role = auth.employee.role;
  const org = auth.org.id;
  const tz = auth.org.timezone;
  const now = serverNow();
  const today = todayIn(tz);
  const dayStartIso = dayRange(today, tz).start.toISOString();
  const db = auth.supabase;

  const [shifts, places, positions, radioCodes, assists, breakAlerts, fatigue, emergency, banners, options] = await Promise.all([
    loadActiveShifts(auth),
    loadPlaces(auth),
    db
      .from("vehicle_latest_positions")
      .select("vehicle_id, shift_id, employee_id, lat, lng, speed_mps, recorded_at")
      .eq("organization_id", org),
    db.from("radio_codes").select("code, label, is_alert").eq("organization_id", org),
    db
      .from("assist_requests")
      .select(
        `id, status, created_at, passenger_name, flight_number, assist_type, passenger_count,
         employee:employees!assist_requests_employee_id_fkey(first_name, last_name),
         vehicle:vehicles(number), airline:airlines(name, iata_code), location:locations(code)`,
      )
      .eq("organization_id", org)
      .in("status", ["pending", "escalated"])
      .order("created_at")
      .limit(30),
    db
      .from("breaks")
      .select(
        `id, kind, status, window_start, window_end, started_at, ended_at, planned_minutes,
         shift:shifts!inner(id, status, employee:employees!shifts_employee_id_fkey(first_name, last_name, employee_number))`,
      )
      .eq("organization_id", org)
      .in("status", ["missed", "overrun"])
      .or(`missed_alerted_at.gte.${dayStartIso},overrun_alerted_at.gte.${dayStartIso}`)
      .order("updated_at", { ascending: false })
      .limit(40),
    db
      .from("fatigue_alerts")
      .select("id, employee_id, kind, severity, message, created_at, employee:employees!fatigue_alerts_employee_id_fkey(first_name, last_name)")
      .eq("organization_id", org)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(40),
    db.from("emergencies").select("id, title, kind, created_at").eq("organization_id", org).eq("active", true).maybeSingle(),
    db
      .from("announcements")
      .select("id, message, active, updated_at")
      .eq("organization_id", org)
      .eq("kind", "overtime")
      .order("updated_at", { ascending: false })
      .limit(8),
    loadAssignOptions(auth),
  ]);

  const posByVehicle = new Map((positions.data ?? []).map((p) => [p.vehicle_id, p]));
  const codes = new Map((radioCodes.data ?? []).map((c) => [c.code, c]));
  const fatigueByEmployee = new Map<string, NonNullable<typeof fatigue.data>>();
  for (const f of fatigue.data ?? []) {
    const list = fatigueByEmployee.get(f.employee_id) ?? [];
    list.push(f);
    fatigueByEmployee.set(f.employee_id, list);
  }
  const placeList: Place[] = places.locations;

  const rows: BoardRow[] = [...shifts]
    .sort((a, b) => ROLE_ORDER[a.employee.role] - ROLE_ORDER[b.employee.role] || a.clock_in_at.localeCompare(b.clock_in_at))
    .map((shift) => {
      const raw = shift.vehicle_id ? posByVehicle.get(shift.vehicle_id) : undefined;
      // Only trust a vehicle's last fix if it was reported on this shift (or by this employee).
      const pos = raw && (raw.shift_id === shift.id || raw.employee_id === shift.employee_id) ? raw : null;
      const stops = routeStops(shift.route?.stop_ids, placeList);
      const next = pos ? nextStop(pos, stops) : null;
      const radio = shift.radio_status ? codes.get(shift.radio_status) : undefined;
      return {
        shift,
        breaks: breakState(shift.breaks, now),
        pos: pos ? { lat: pos.lat, lng: pos.lng, speed: pos.speed_mps, at: pos.recorded_at } : null,
        where: pos ? describePosition(pos, placeList) : null,
        eta: next ? { stop: next.stop.code, distance: next.distance, seconds: etaSeconds(next.distance, pos?.speed_mps) } : null,
        fatigue: fatigueByEmployee.get(shift.employee_id) ?? [],
        radio: shift.radio_status
          ? { code: shift.radio_status, label: radio?.label ?? null, alert: radio?.is_alert ?? false, at: shift.radio_status_at }
          : null,
      };
    });

  const data: BoardData = {
    rows,
    assists: assists.data ?? [],
    breakAlerts: breakAlerts.data ?? [],
    fatigue: fatigue.data ?? [],
    emergency: emergency.data ?? null,
    banners: banners.data ?? [],
    options,
  };

  return (
    <>
      <LiveRefresh
        organizationId={org}
        tables={["shifts", "breaks", "vehicles", "vehicle_latest_positions", "assist_requests", "fatigue_alerts", "announcements", "emergencies"]}
        debounceMs={1500}
      />
      <BoardView
        data={data}
        wall={isWall}
        serverNow={now}
        timeZone={tz}
        clock24h={auth.settings.clock24h}
        escalationMinutes={auth.settings.assist.escalationMinutes}
        organizationName={auth.org.name}
        canAssign={!isWall && can(role, "signInSheetAssign")}
        canReopen={!isWall && can(role, "breakReopen")}
        canBanner={!isWall && can(role, "overtime")}
        canMap={can(role, "map")}
        canAssists={can(role, "assists")}
        canFatigue={can(role, "fatigue")}
      />
    </>
  );
}
