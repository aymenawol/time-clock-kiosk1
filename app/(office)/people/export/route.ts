import { requireAuth } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { toCsv } from "@/lib/labor/payroll";

export async function GET() {
  const auth = await requireAuth("people");
  const { data } = await auth.supabase
    .from("employees")
    .select("employee_number, first_name, last_name, email, phone, role, status, job_title, hire_date, seniority_number, user_id")
    .eq("organization_id", auth.org.id)
    .order("seniority_number", { nullsFirst: false })
    .order("hire_date")
    .limit(5000);
  const rows: (string | number | null)[][] = [
    ["Employee #", "First name", "Last name", "Email", "Phone", "Role", "Status", "Job title", "Hire date", "Seniority", "Has login"],
    ...(data ?? []).map((e) => [
      e.employee_number,
      e.first_name,
      e.last_name,
      e.email,
      e.phone,
      ROLE_LABEL[e.role],
      e.status,
      e.job_title,
      e.hire_date,
      e.seniority_number,
      e.user_id ? "yes" : "no",
    ]),
  ];
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="employees-${auth.org.slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
