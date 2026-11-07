import Image from "next/image";
import { cn } from "@/lib/cn";

export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/rolecall-logo.svg"
      alt=""
      width={28}
      height={28}
      className={cn("size-7 shrink-0", className)}
      priority
      unoptimized
    />
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight text-fg", className)}>
      <BrandMark />
      <span>
        Role<span className="text-primary">Call</span>
      </span>
    </span>
  );
}
