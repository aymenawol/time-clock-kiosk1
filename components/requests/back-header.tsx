import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import * as React from "react";

/** Title row for field sub-pages with a back link. */
export function BackHeader({
  href,
  backLabel = "Back",
  title,
  description,
  actions,
}: {
  href: string;
  backLabel?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <Link href={href} className="-ml-1 inline-flex h-10 items-center gap-1 text-sm font-medium text-primary">
        <ChevronLeft className="size-4" aria-hidden />
        {backLabel}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        {actions}
      </div>
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-[var(--radius-control)] bg-danger-soft px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

/** A page-level load failure. */
export function LoadError({ what }: { what: string }) {
  return <ErrorNote>Could not load {what}. Pull down to refresh or try again in a moment.</ErrorNote>;
}
