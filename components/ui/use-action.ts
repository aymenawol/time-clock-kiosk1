"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Run a server action from a client component. Shows a toast on error (and
 * on success when `success` is given), refreshes server data, and exposes
 * field errors for forms.
 *
 *   const [run, pending, fieldErrors] = useAction(saveVehicle, { success: "Saved" });
 *   await run(values);
 */
export function useAction<I, T>(
  fn: (input: I) => Promise<Result<T>>,
  opts: { success?: string | ((data: T) => string); refresh?: boolean; onSuccess?: (data: T) => void } = {},
) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const run = useCallback(
    async (input: I): Promise<Result<T>> => {
      setRunning(true);
      try {
        const res = await fn(input);
        if (res.ok) {
          setFieldErrors({});
          if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(res.data) : opts.success);
          opts.onSuccess?.(res.data);
          if (opts.refresh !== false) startTransition(() => router.refresh());
        } else {
          setFieldErrors(res.fieldErrors ?? {});
          toast.error(res.error);
        }
        return res;
      } catch {
        toast.error("Could not reach the server. Check your connection.");
        return { ok: false, error: "network" };
      } finally {
        setRunning(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn, router],
  );

  return [run, running || pending, fieldErrors] as const;
}
