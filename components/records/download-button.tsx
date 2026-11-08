import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Plain link to a CSV route handler. */
export function CsvLink({ href, label = "Export CSV" }: { href: string; label?: string }) {
  return (
    <Button asChild variant="secondary">
      <a href={href} download>
        <Download aria-hidden />
        {label}
      </a>
    </Button>
  );
}
