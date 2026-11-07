import { redirect } from "next/navigation";
import { homeFor } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";

export default async function Home() {
  const auth = await requireAuth();
  redirect(homeFor(auth.employee.role));
}
