"use client";

import { MonitorSmartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pairKiosk } from "./actions";

export function KioskPairing() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await pairKiosk(code);
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(res.error);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-md">
        <Wordmark className="text-2xl" />
        <div className="mt-10 flex items-center gap-3">
          <MonitorSmartphone className="size-8 text-accent" aria-hidden />
          <h1 className="text-3xl font-semibold tracking-tight">Pair this kiosk</h1>
        </div>
        <p className="mt-3 text-muted">
          An admin creates a pairing code in <strong className="text-fg">Settings → Kiosks</strong>. Enter it here to
          bind this tablet to your organization. Codes expire after 15 minutes.
        </p>
        <label htmlFor="code" className="mt-8 block text-sm font-medium">
          Pairing code
        </label>
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={9}
          className="mt-2 h-16 text-center font-mono text-3xl tracking-[0.3em]"
          required
        />
        {error ? (
          <p role="alert" className="mt-3 rounded-[var(--radius-control)] bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="xl" className="mt-6 w-full" loading={busy}>
          Pair kiosk
        </Button>
      </form>
    </div>
  );
}
