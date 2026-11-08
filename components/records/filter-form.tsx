import Link from "next/link";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** GET form: filters live in the URL, so pages stay Server Components. */
export function FilterForm({
  clearHref,
  children,
  hidden,
}: {
  clearHref: string;
  children: React.ReactNode;
  hidden?: Record<string, string>;
}) {
  return (
    <Card className="mb-4">
      <form method="get" className="flex flex-wrap items-end gap-3 p-3">
        {Object.entries(hidden ?? {}).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        {children}
        <div className="flex items-center gap-2">
          <Button type="submit" size="md">
            Apply
          </Button>
          <Button asChild variant="ghost">
            <Link href={clearHref}>Clear</Link>
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function FilterField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-36 flex-col gap-1 text-xs font-medium text-muted ${className ?? ""}`}>
      {label}
      {children}
    </label>
  );
}
