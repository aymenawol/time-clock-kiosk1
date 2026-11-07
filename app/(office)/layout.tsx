import { redirect } from "next/navigation";
import { OfficeShell } from "@/components/shell/office-shell";
import { toShellUser } from "@/components/shell/shell-user";
import { isOfficeRole } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  // Field roles use the phone app. Chat and emergency are also there.
  if (!isOfficeRole(auth.employee.role)) redirect("/m");
  return <OfficeShell user={toShellUser(auth)}>{children}</OfficeShell>;
}
