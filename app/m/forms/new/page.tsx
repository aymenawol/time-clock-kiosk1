import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BackHeader } from "@/components/requests/back-header";
import { requireAuth } from "@/lib/auth/session";
import { FORM_META, FORM_TYPES } from "@/lib/forms";

export const metadata: Metadata = { title: "New request" };

export default async function NewFormPage() {
  await requireAuth("field");
  return (
    <>
      <BackHeader href="/m/forms" backLabel="My forms" title="New request" description="What do you need?" />
      <ul className="flex flex-col gap-3">
        {FORM_TYPES.map((type) => (
          <li key={type}>
            <Link
              href={`/m/forms/new/${type}`}
              className="flex min-h-16 items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4 hover:bg-surface-2"
            >
              <span>
                <span className="block font-medium">{FORM_META[type].label}</span>
                <span className="block text-sm text-muted">{FORM_META[type].description}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
