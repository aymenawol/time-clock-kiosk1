/**
 * Position helpers for the board and the map (v0 lib/gps-utils, rebuilt for
 * per-organization locations instead of hardcoded terminals).
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Place {
  id: string;
  name: string;
  code: string;
  lat: number | null;
  lng: number | null;
  radius_m: number;
}

type PlaceWithCoords = Place & LatLng;

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function hasCoords(p: Place): p is PlaceWithCoords {
  return typeof p.lat === "number" && typeof p.lng === "number";
}

export interface NearestPlace {
  place: Place;
  distance: number;
  inside: boolean;
}

/** The closest place with coordinates, and whether the position is inside its radius. */
export function nearestPlace(pos: LatLng, places: Place[]): NearestPlace | null {
  let best: NearestPlace | null = null;
  for (const p of places) {
    if (!hasCoords(p)) continue;
    const distance = haversineMeters(pos, p);
    if (!best || distance < best.distance) best = { place: p, distance, inside: distance <= p.radius_m };
  }
  return best;
}

/**
 * The next stop on a route. If the vehicle is inside a stop's radius the next
 * stop is the following one in route order (routes loop); otherwise it is the
 * nearest stop on the route.
 */
export function nextStop(pos: LatLng, stops: Place[]): { stop: Place; distance: number } | null {
  const withCoords = stops.filter(hasCoords);
  if (withCoords.length === 0) return null;
  const distances = withCoords.map((s) => haversineMeters(pos, s));
  let atIndex = -1;
  withCoords.forEach((s, i) => {
    if (distances[i] <= s.radius_m && (atIndex === -1 || distances[i] < distances[atIndex])) atIndex = i;
  });
  if (atIndex >= 0) {
    if (withCoords.length === 1) return null;
    const next = (atIndex + 1) % withCoords.length;
    return { stop: withCoords[next], distance: distances[next] };
  }
  let nearest = 0;
  distances.forEach((d, i) => {
    if (d < distances[nearest]) nearest = i;
  });
  return { stop: withCoords[nearest], distance: distances[nearest] };
}

/** Seconds to cover a distance at the current speed, or null when not moving (< 1 m/s). */
export function etaSeconds(distanceM: number, speedMps: number | null | undefined): number | null {
  if (speedMps === null || speedMps === undefined || speedMps < 1) return null;
  return distanceM / speedMps;
}

/** US units: feet under 0.1 mile, then miles. */
export function fmtDistance(m: number): string {
  if (m < 161) return `${Math.round(m * 3.28084)} ft`;
  return `${(m / 1609.344).toFixed(1)} mi`;
}

export function fmtEta(seconds: number | null): string {
  if (seconds === null) return "-";
  if (seconds < 60) return "< 1 min";
  return `${Math.round(seconds / 60)} min`;
}

/** "At T1" or "0.4 mi from T1". */
export function describePosition(pos: LatLng, places: Place[]): string | null {
  const n = nearestPlace(pos, places);
  if (!n) return null;
  return n.inside ? `At ${n.place.code}` : `${fmtDistance(n.distance)} from ${n.place.code}`;
}

/** Centre of a set of points (simple average; fine at airport scale). */
export function centroid(points: LatLng[]): LatLng | null {
  if (points.length === 0) return null;
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

/** A position is stale after two minutes without an update. */
export const STALE_AFTER_MS = 2 * 60_000;
