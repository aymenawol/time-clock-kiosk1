import type { Metadata } from "next";
import Link from "next/link";
import { MonitorSmartphone } from "lucide-react";
import { Wordmark } from "@/components/shell/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col justify-center px-6 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Wordmark className="text-xl" />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Use the email your admin set up for you.</p>
          <LoginForm next={next} />
          <p className="mt-6 text-sm text-muted">
            Forgot your password? Ask your admin to reset it from your employee profile.
          </p>
          <Link
            href="/kiosk"
            className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <MonitorSmartphone className="size-4" /> Open the time clock kiosk
          </Link>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-[#0b1b3a] lg:block" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(9,95,252,0.55),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(245,165,36,0.35),transparent_50%)]" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <p className="max-w-md text-3xl font-semibold leading-tight">
            The whole ground operation, from the first clock-in to the last bus back.
          </p>
          <p className="mt-4 max-w-md text-white/70">
            Time clock, dispatch, fleet readiness, inspections and payroll in one place, for every role.
          </p>
        </div>
      </div>
    </div>
  );
}
