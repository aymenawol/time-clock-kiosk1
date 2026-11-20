"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Prints the page; the print styles hide the app shell and put each sheet on its own page. */
export function PrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      <Printer />
      Print
    </Button>
  );
}
