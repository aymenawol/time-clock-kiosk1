import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompensationForm, LeaveAdjustForm, LoginPanel, PinPanel, ProfileForm, RoleStatusForm } from "@/components/people/employee-panels";
import { EMPLOYEE_STATUS } from "@/components/people/labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, PageHeader, Stat } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can, ROLE_LABEL } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { fmtDate, fmtDateTime, fmtLocalDate, fmtMinutes, fmtMoney, fullName } from "@/lib/format";
import { LEAVE_KINDS, LEAVE_LABEL } from "@/lib/forms";
import { zId } from "@/lib/actions";
import { loadPinStatus } from "../pin-status";

export const metadata = { title: "Employee" };

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg">{children || "-"}</dd>
    </div>
  );
}

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("people");
  const { id } = await params;
  if (!zId.safeParse(id).success) notFound();
  const tz = auth.org.timezone;
  const clock24h = auth.settings.clock24h;
  const isAdmin = can(auth.employee.role, "peopleEdit");

  const { data: employee } = await auth.supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .eq("organization_id", auth.org.id)
    .maybeSingle();
  if (!employee) notFound();

  const [comp, pins, ledger, shifts, events] = await Promise.all([
    auth.supabase.from("employee_compensation").select("*").eq("employee_id", id).maybeSingle(),
    loadPinStatus(auth, [id]),
    auth.supabase
      .from("leave_ledger")
      .select("id, kind, hours, reason, created_at, form_id")
      .eq("organization_id", auth.org.id)
      .eq("employee_id", id)
      .order("created_at", { ascending: false })
      .limit(500),
    auth.supabase
      .from("shifts")
      .select("id, work_date, clock_in_at, clock_out_at, status")
      .eq("organization_id", auth.org.id)
      .eq("employee_id", id)
      .order("clock_in_at", { ascending: false })
      .limit(10),
    auth.supabase
      .from("audit_events")
      .select("id, action, data, created_at, actor_employee_id")
      .eq("organization_id", auth.org.id)
      .eq("entity", "employees")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const actorIds = [...new Set((events.data ?? []).map((e) => e.actor_employee_id).filter((x): x is string => Boolean(x)))];
  const { data: actors } = actorIds.length
    ? await auth.supabase.from("employees").select("id, first_name, last_name").in("id", actorIds)
    : { data: [] };
  const actorName = new Map((actors ?? []).map((a) => [a.id, fullName(a)]));

  const balances = Object.fromEntries(LEAVE_KINDS.map((k) => [k, 0])) as Record<(typeof LEAVE_KINDS)[number], number>;
  for (const row of ledger.data ?? []) {
    if (row.kind in balances) balances[row.kind as keyof typeof balances] += Number(row.hours);
  }

  const pin = pins?.get(id);
  const lockedUntil = pin?.lockedUntil && new Date(pin.lockedUntil) > new Date() ? pin.lockedUntil : null;
  const st = EMPLOYEE_STATUS[employee.status];
  const threshold = fmtMoney(auth.settings.labor.minimumWageCents * 1.5);
  const name = fullName(employee);

  return (
    <>
      <Link href="/people" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Employees
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar name={name} className="size-10 text-sm" />
            {name}
          </span>
        }
        description={`#${employee.employee_number} · ${ROLE_LABEL[employee.role]}${employee.job_title ? ` · ${employee.job_title}` : ""}`}
        actions={
          <Badge tone={st.tone} dot>
            {st.label}
          </Badge>
        }
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="flex flex-col gap-5 xl:col-span-2">
          <Card>
            <CardHeader title="Profile" />
            <CardBody>
              {isAdmin ? (
                <ProfileForm employee={employee} />
              ) : (
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Detail label="Email">{employee.email}</Detail>
                  <Detail label="Phone">{employee.phone}</Detail>
                  <Detail label="Hire date">{fmtLocalDate(employee.hire_date, "MMM d, yyyy")}</Detail>
                  <Detail label="Seniority">{employee.seniority_number}</Detail>
                  <Detail label="Notes">{employee.notes}</Detail>
                </dl>
              )}
            </CardBody>
          </Card>

          {isAdmin ? (
            <>
              <Card>
                <CardHeader title="Role and status" description="The last active admin cannot be demoted or terminated." />
                <CardBody>
                  <RoleStatusForm employee={employee} isSelf={employee.id === auth.employee.id} />
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Compensation" description="Only admins can see pay." />
                <CardBody>
                  <CompensationForm
                    employeeId={id}
                    payRateCents={comp.data?.pay_rate_cents ?? 0}
                    exempt={comp.data?.daily_ot_exempt ?? false}
                    reason={comp.data?.ot_exempt_reason ?? null}
                    minimumWageCents={auth.settings.labor.minimumWageCents}
                    threshold={threshold}
                  />
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Kiosk PIN" description="Used to clock in and out at the shared tablet." />
                <CardBody>
                  <PinPanel
                    employeeId={id}
                    pinSet={pin?.pinSet ?? false}
                    failedCount={pin?.failedCount ?? 0}
                    lockedUntilLabel={lockedUntil ? fmtDateTime(lockedUntil, tz, clock24h) : null}
                  />
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Login" description="Lets them sign in on a phone or desktop." />
                <CardBody>
                  <LoginPanel employeeId={id} hasLogin={Boolean(employee.user_id)} email={employee.email} />
                </CardBody>
              </Card>
            </>
          ) : null}

          <Card>
            <CardHeader title="Leave balances" description="Hours remaining, from the leave ledger." />
            <CardBody className="grid gap-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {LEAVE_KINDS.map((k) => (
                  <Stat key={k} label={LEAVE_LABEL[k]} value={`${balances[k].toFixed(2)} h`} tone={balances[k] < 0 ? "danger" : undefined} />
                ))}
              </div>
              {isAdmin ? <LeaveAdjustForm employeeId={id} /> : null}
            </CardBody>
            {(ledger.data ?? []).length ? (
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Date</TH>
                    <TH>Type</TH>
                    <TH className="text-right">Hours</TH>
                    <TH>Reason</TH>
                  </TR>
                </THead>
                <TBody>
                  {(ledger.data ?? []).slice(0, 20).map((r) => (
                    <TR key={r.id}>
                      <TD className="whitespace-nowrap">{fmtDate(r.created_at, tz, "MMM d, yyyy")}</TD>
                      <TD>{LEAVE_LABEL[r.kind as keyof typeof LEAVE_LABEL] ?? r.kind}</TD>
                      <TD className={`tabular text-right ${Number(r.hours) < 0 ? "text-danger" : "text-success"}`}>
                        {Number(r.hours) > 0 ? "+" : ""}
                        {Number(r.hours).toFixed(2)}
                      </TD>
                      <TD className="text-muted">{r.reason}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            ) : null}
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader
              title="Recent shifts"
              actions={
                can(auth.employee.role, "timesheets") ? (
                  <Link href={`/timesheets/${id}`} className="text-sm text-primary hover:underline">
                    Timesheet
                  </Link>
                ) : null
              }
            />
            {(shifts.data ?? []).length === 0 ? (
              <p className="p-4 text-sm text-muted">No shifts yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {(shifts.data ?? []).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div>
                      <p className="font-medium">{fmtDate(s.clock_in_at, tz)}</p>
                      <p className="text-xs text-muted">
                        {fmtDateTime(s.clock_in_at, tz, clock24h).split(", ")[1]} to{" "}
                        {s.clock_out_at ? fmtDateTime(s.clock_out_at, tz, clock24h).split(", ")[1] : "now"}
                      </p>
                    </div>
                    <span className="tabular text-muted">
                      {s.status === "void"
                        ? "Void"
                        : s.status === "active"
                          ? "Open"
                          : fmtMinutes((new Date(s.clock_out_at!).getTime() - new Date(s.clock_in_at).getTime()) / 60000)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {isAdmin ? (
            <Card>
              <CardHeader title="Recent changes" />
              {(events.data ?? []).length === 0 ? (
                <p className="p-4 text-sm text-muted">Nothing recorded yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {(events.data ?? []).map((ev) => (
                    <li key={ev.id} className="px-4 py-2.5 text-sm">
                      <p className="font-medium">{ev.action.replace(/^employee\./, "").replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted">
                        {ev.actor_employee_id ? (actorName.get(ev.actor_employee_id) ?? "Someone") : "System"} ·{" "}
                        {fmtDateTime(ev.created_at, tz, clock24h)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
