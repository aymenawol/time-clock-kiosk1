"use client";

import { MapPin, MapPinOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Reports the phone's position while the driver is on a shift with a vehicle.
 * Mounted in the field layout so it keeps running across pages. The server
 * (public.record_position) derives the vehicle from the caller's active shift
 * and throttles writes; this only sends at most one fix per interval.
 */
export function GpsReporter({ shiftId, intervalSeconds }: { shiftId: string; intervalSeconds: number }) {
  const [state, setState] = useState<"starting" | "ok" | "denied" | "unavailable">("starting");
  const lastSent = useRef(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const t = setTimeout(() => setState("unavailable"), 0);
      return () => clearTimeout(t);
    }
    const supabase = createClient();
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setState("ok");
        const now = Date.now();
        if (now - lastSent.current < intervalSeconds * 1000) return;
        lastSent.current = now;
        const { latitude, longitude, speed, heading, accuracy } = pos.coords;
        void supabase.rpc("record_position", {
          p_lat: latitude,
          p_lng: longitude,
          p_speed_mps: speed ?? undefined,
          p_heading: heading ?? undefined,
          p_accuracy_m: accuracy ?? undefined,
        });
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [shiftId, intervalSeconds]);

  if (state === "ok" || state === "starting" || dismissed) {
    return (
      <span className="sr-only" role="status">
        Location sharing is on while you are on shift.
      </span>
    );
  }
  return (
    <div role="status" className="fixed inset-x-0 top-14 z-20 mx-auto max-w-xl px-4 pt-2">
      <div className="flex items-center gap-2 rounded-[var(--radius-card)] border border-warning bg-warning-soft px-3 py-2 text-sm text-warning shadow-[var(--shadow-pop)]">
        {state === "denied" ? <MapPinOff className="size-4 shrink-0" /> : <MapPin className="size-4 shrink-0" />}
        <span className="min-w-0 flex-1">
          {state === "denied"
            ? "Location is blocked. Allow location for this site so dispatch can see your vehicle."
            : "Location is unavailable right now."}
        </span>
        <button type="button" onClick={() => setDismissed(true)} className="rounded p-1 hover:bg-warning/10" aria-label="Dismiss">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
