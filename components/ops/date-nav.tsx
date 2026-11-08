"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { shiftYmd } from "./time";

/** Date picker for day-based pages. Navigates with ?date=yyyy-MM-dd. */
export function DateNav({ basePath, date, today }: { basePath: string; date: string; today: string }) {
  const router = useRouter();
  const href = (d: string) => (d === today ? basePath : `${basePath}?date=${d}`);
  return (
    <div className="flex items-center gap-1 print:hidden">
      <Link
        href={href(shiftYmd(date, -1))}
        className={buttonVariants({ variant: "secondary", size: "icon" })}
        aria-label="Previous day"
      >
        <ChevronLeft />
      </Link>
      <label className="sr-only" htmlFor="date-nav">
        Date
      </label>
      <Input
        id="date-nav"
        type="date"
        value={date}
        max={shiftYmd(today, 1)}
        onChange={(e) => {
          if (e.target.value) router.push(href(e.target.value));
        }}
        className="w-40"
      />
      <Link
        href={href(shiftYmd(date, 1))}
        className={cn(buttonVariants({ variant: "secondary", size: "icon" }), date >= today && "pointer-events-none opacity-50")}
        aria-label="Next day"
        aria-disabled={date >= today}
        tabIndex={date >= today ? -1 : undefined}
      >
        <ChevronRight />
      </Link>
      {date !== today ? (
        <Link href={basePath} className={buttonVariants({ variant: "ghost", size: "md" })}>
          Today
        </Link>
      ) : null}
    </div>
  );
}
