"use client";

import {
  AdvancedMarker,
  APILoadingStatus,
  APIProvider,
  Circle,
  ColorScheme,
  InfoWindow,
  Map,
  Polyline,
  useApiLoadingStatus,
  useMap,
} from "@vis.gl/react-google-maps";
import { MapPinOff, Navigation } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { VEHICLE_STATUS, VehicleStatusPill } from "@/components/domain/status";
import { centroid, describePosition, hasCoords, STALE_AFTER_MS, type LatLng, type Place } from "@/components/ops/geo";
import { Age, useNow } from "@/components/ops/timers";
import type { Tone } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import type { VehicleStatus } from "@/lib/supabase/types";

export interface MapVehicle {
  vehicleId: string;
  number: string;
  status: VehicleStatus;
  shiftId: string;
  employeeId: string;
  driverName: string;
  routeName: string | null;
  routeColor: string | null;
}

export interface MapPosition {
  vehicle_id: string;
  shift_id: string | null;
  employee_id: string | null;
  lat: number;
  lng: number;
  speed_mps: number | null;
  heading: number | null;
  recorded_at: string;
}

export interface MapRoute {
  id: string;
  name: string;
  color: string;
  path: LatLng[];
}

// Advanced markers need a map ID. Google's demo ID works for development;
// set a real one per deployment when cloud styling is needed.
const MAP_ID = "DEMO_MAP_ID";

const MARKER_TONE: Record<Tone, string> = {
  success: "bg-success text-white",
  primary: "bg-primary text-primary-fg",
  info: "bg-info text-white",
  warning: "bg-warning text-white",
  danger: "bg-danger text-white",
  accent: "bg-accent text-black",
  neutral: "bg-surface-3 text-fg",
};

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function newer(a: MapPosition | undefined, b: MapPosition | undefined) {
  if (!a) return b;
  if (!b) return a;
  return new Date(b.recorded_at).getTime() > new Date(a.recorded_at).getTime() ? b : a;
}

export function LiveMap({
  organizationId,
  apiKey,
  vehicles,
  positions,
  locations,
  routes,
  serverNow,
}: {
  organizationId: string;
  apiKey: string | null;
  vehicles: MapVehicle[];
  positions: MapPosition[];
  locations: Place[];
  routes: MapRoute[];
  serverNow: number;
}) {
  const [live, setLive] = useState<Record<string, MapPosition>>({});
  const [selected, setSelected] = useState<{ id: string; nonce: number } | null>(null);

  // Move markers straight from Realtime; the server page refreshes only when shifts or vehicles change.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`map:${organizationId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehicle_latest_positions", filter: `organization_id=eq.${organizationId}` },
        (payload) => {
          const row = payload.new as Partial<MapPosition>;
          if (!row || typeof row.vehicle_id !== "string" || typeof row.lat !== "number" || typeof row.lng !== "number") return;
          const pos = row as MapPosition;
          setLive((prev) => ({ ...prev, [pos.vehicle_id]: newer(prev[pos.vehicle_id], pos) ?? pos }));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId]);

  const fromServer = useMemo(() => Object.fromEntries(positions.map((p) => [p.vehicle_id, p])), [positions]);

  const items = vehicles.map((v) => {
    const p = newer(fromServer[v.vehicleId], live[v.vehicleId]);
    // Ignore a fix left over from an earlier shift on the same vehicle.
    const pos = p && (p.shift_id === v.shiftId || p.employee_id === v.employeeId) ? p : null;
    return { vehicle: v, pos };
  });

  const center = useMemo(() => {
    const placed = locations.filter(hasCoords).map((l) => ({ lat: l.lat, lng: l.lng }));
    return centroid(placed) ?? centroid(positions.map((p) => ({ lat: p.lat, lng: p.lng })));
  }, [locations, positions]);

  const list = (
    <VehicleList
      items={items}
      locations={locations}
      serverNow={serverNow}
      selectedId={selected?.id ?? null}
      onSelect={(id) => setSelected({ id, nonce: Date.now() })}
      interactive={Boolean(apiKey)}
    />
  );

  if (!apiKey) {
    return (
      <div className="flex flex-col gap-4">
        <div role="alert" className="flex items-start gap-3 rounded-[var(--radius-card)] border border-warning/40 bg-warning-soft px-4 py-3 text-sm">
          <MapPinOff className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p>
            The map is not available because no Google Maps key is configured. Ask an admin to set{" "}
            <code className="font-mono text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>. The vehicle list below still updates live.
          </p>
        </div>
        {list}
      </div>
    );
  }

  const selectedItem = selected ? items.find((i) => i.vehicle.vehicleId === selected.id) : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="relative h-[60vh] min-h-[360px] overflow-hidden rounded-[var(--radius-card)] border border-border lg:h-[calc(100dvh-12rem)]">
        <APIProvider apiKey={apiKey}>
          <MapCanvas
            center={center}
            items={items}
            locations={locations}
            routes={routes}
            serverNow={serverNow}
            selected={selected}
            selectedItem={selectedItem}
            onSelect={(id) => setSelected(id ? { id, nonce: Date.now() } : null)}
          />
          <LoadState />
        </APIProvider>
      </div>
      {list}
    </div>
  );
}

type Item = { vehicle: MapVehicle; pos: MapPosition | null };

function MapCanvas({
  center,
  items,
  locations,
  routes,
  serverNow,
  selected,
  selectedItem,
  onSelect,
}: {
  center: LatLng | null;
  items: Item[];
  locations: Place[];
  routes: MapRoute[];
  serverNow: number;
  selected: { id: string; nonce: number } | null;
  selectedItem: Item | undefined;
  onSelect: (id: string | null) => void;
}) {
  const { resolvedTheme } = useTheme();
  const now = useNow(serverNow);
  const placeStroke = cssVar("--info", "#0b6bcb");
  const dark = resolvedTheme === "dark";

  return (
    <Map
      key={dark ? "dark" : "light"}
      mapId={MAP_ID}
      colorScheme={dark ? ColorScheme.DARK : ColorScheme.LIGHT}
      defaultCenter={center ?? { lat: 20, lng: 0 }}
      defaultZoom={center ? 14 : 2}
      gestureHandling="greedy"
      disableDefaultUI={false}
      streetViewControl={false}
      mapTypeControl={false}
      style={{ width: "100%", height: "100%" }}
      onClick={() => onSelect(null)}
    >
      {routes.map((r) =>
        r.path.length > 1 ? (
          <Polyline
            key={r.id}
            path={r.path.length > 2 ? [...r.path, r.path[0]] : r.path}
            strokeColor={r.color}
            strokeOpacity={0.75}
            strokeWeight={4}
            clickable={false}
          />
        ) : null,
      )}
      {locations.filter(hasCoords).map((l) => (
        <Circle
          key={l.id}
          center={{ lat: l.lat, lng: l.lng }}
          radius={l.radius_m}
          strokeColor={placeStroke}
          strokeOpacity={0.6}
          strokeWeight={1}
          fillColor={placeStroke}
          fillOpacity={0.08}
          clickable={false}
        />
      ))}
      {locations.filter(hasCoords).map((l) => (
        <AdvancedMarker key={`label-${l.id}`} position={{ lat: l.lat, lng: l.lng }} zIndex={1} title={l.name}>
          <span className="rounded border border-border bg-surface/90 px-1.5 py-0.5 text-[10px] font-semibold text-muted">{l.code}</span>
        </AdvancedMarker>
      ))}
      {items.map(({ vehicle, pos }) => {
        if (!pos) return null;
        const stale = now - new Date(pos.recorded_at).getTime() > STALE_AFTER_MS;
        const tone = VEHICLE_STATUS[vehicle.status].tone;
        const isSelected = selected?.id === vehicle.vehicleId;
        return (
          <AdvancedMarker
            key={vehicle.vehicleId}
            position={{ lat: pos.lat, lng: pos.lng }}
            zIndex={isSelected ? 30 : 10}
            title={`Vehicle ${vehicle.number} · ${vehicle.driverName}${stale ? " · stale" : ""}`}
            onClick={() => onSelect(vehicle.vehicleId)}
          >
            <span
              className={cn(
                "flex items-center gap-1 rounded-full border-2 border-white px-2 py-0.5 font-mono text-xs font-bold shadow-[var(--shadow-pop)]",
                MARKER_TONE[tone],
                stale && "opacity-50 grayscale",
                isSelected && "ring-2 ring-primary ring-offset-1",
              )}
            >
              {pos.heading !== null && !stale ? (
                <Navigation className="size-3" style={{ transform: `rotate(${pos.heading}deg)` }} aria-hidden />
              ) : null}
              {vehicle.number}
            </span>
          </AdvancedMarker>
        );
      })}
      {selectedItem?.pos ? (
        <InfoWindow
          position={{ lat: selectedItem.pos.lat, lng: selectedItem.pos.lng }}
          pixelOffset={[0, -28]}
          onCloseClick={() => onSelect(null)}
          headerContent={<span className="font-semibold text-black">Vehicle {selectedItem.vehicle.number}</span>}
        >
          <div className="text-sm text-black">
            <p>{selectedItem.vehicle.driverName}</p>
            {selectedItem.vehicle.routeName ? <p>{selectedItem.vehicle.routeName}</p> : null}
            <p>
              {describePosition(selectedItem.pos, locations) ?? ""}
              {selectedItem.pos.speed_mps !== null ? ` · ${Math.round(selectedItem.pos.speed_mps * 2.23694)} mph` : ""}
            </p>
          </div>
        </InfoWindow>
      ) : null}
      <PanTo target={selected && selectedItem?.pos ? { ...selectedItem.pos, nonce: selected.nonce } : null} />
    </Map>
  );
}

/** Pan to the selected vehicle once per click (nonce), not on every GPS update. */
function PanTo({ target }: { target: (LatLng & { nonce: number }) | null }) {
  const map = useMap();
  const nonce = target?.nonce;
  useEffect(() => {
    if (!map || !target) return;
    map.panTo({ lat: target.lat, lng: target.lng });
    if ((map.getZoom() ?? 0) < 15) map.setZoom(15);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, nonce]);
  return null;
}

function LoadState() {
  const status = useApiLoadingStatus();
  if (status !== APILoadingStatus.FAILED && status !== APILoadingStatus.AUTH_FAILURE) return null;
  return (
    <div role="alert" className="absolute inset-0 flex items-center justify-center bg-surface p-6 text-center text-sm">
      <p>
        Google Maps could not load{status === APILoadingStatus.AUTH_FAILURE ? " (the API key was rejected)" : ""}. Use the
        vehicle list, or ask an admin to check the Maps key.
      </p>
    </div>
  );
}

function VehicleList({
  items,
  locations,
  serverNow,
  selectedId,
  onSelect,
  interactive,
}: {
  items: Item[];
  locations: Place[];
  serverNow: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  interactive: boolean;
}) {
  const now = useNow(serverNow);
  return (
    <Card className="min-w-0 lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto">
      <CardHeader title="Vehicles" description={`${items.length} on active shifts`} />
      {items.length === 0 ? (
        <EmptyState title="No vehicles on shift" description="Vehicles appear once dispatch assigns them to a shift." />
      ) : (
        <ul className="divide-y divide-border">
          {items.map(({ vehicle, pos }) => {
            const stale = pos ? now - new Date(pos.recorded_at).getTime() > STALE_AFTER_MS : false;
            const where = pos ? describePosition(pos, locations) : null;
            const content = (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-mono font-semibold">{vehicle.number}</span>
                    <VehicleStatusPill status={vehicle.status} />
                  </span>
                  {pos ? (
                    <Age at={pos.recorded_at} serverNow={serverNow} staleAfterMs={STALE_AFTER_MS} suffix=" ago" className="text-xs" />
                  ) : (
                    <span className="text-xs text-muted">No GPS</span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-sm text-muted">
                  {vehicle.driverName}
                  {vehicle.routeName ? ` · ${vehicle.routeName}` : ""}
                </p>
                {pos ? (
                  <p className={cn("text-xs", stale ? "text-warning" : "text-fg")}>
                    {stale ? "Stale · " : ""}
                    {where ?? "Position known"}
                  </p>
                ) : null}
              </>
            );
            return (
              <li key={vehicle.vehicleId}>
                {interactive && pos ? (
                  <button
                    type="button"
                    onClick={() => onSelect(vehicle.vehicleId)}
                    aria-pressed={selectedId === vehicle.vehicleId}
                    className={cn(
                      "block w-full px-4 py-3 text-left hover:bg-surface-2/60 focus-visible:bg-surface-2",
                      selectedId === vehicle.vehicleId && "bg-primary-soft",
                    )}
                  >
                    {content}
                  </button>
                ) : (
                  <div className="px-4 py-3">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
