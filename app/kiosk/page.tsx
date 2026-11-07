import type { Metadata } from "next";
import { getKioskDevice } from "@/lib/kiosk";
import { KioskClock } from "./kiosk-clock";
import { KioskPairing } from "./kiosk-pairing";

export const metadata: Metadata = { title: "Time clock" };
export const dynamic = "force-dynamic";

export default async function KioskPage() {
  const device = await getKioskDevice();
  const dark = !device || device.settings.kiosk.theme === "dark";
  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-dvh bg-bg text-fg">
        {device ? (
          <KioskClock
            organizationName={device.organizationName}
            deviceName={device.deviceName}
            timeZone={device.timeZone}
            clock24h={device.settings.clock24h}
            idleResetSeconds={device.settings.kiosk.idleResetSeconds}
          />
        ) : (
          <KioskPairing />
        )}
      </div>
    </div>
  );
}
