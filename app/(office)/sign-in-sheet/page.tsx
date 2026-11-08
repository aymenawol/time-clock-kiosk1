import { Download, Signature } from "lucide-react";
import type { Metadata } from "next";
import { AssignDialog } from "@/components/ops/assign-dialog";
import { DateNav } from "@/components/ops/date-nav";
import { PrintStyles } from "@/components/ops/print-styles";
import { loadAssignOptions } from "@/components/ops/queries";
import { parseYmd } from "@/components/ops/time";
import { LiveRefresh } from "@/components/realtime/use-live-refresh";
import { Badge, type Tone } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireAuth } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { fmtLocalDate, fmtTime, fullName, todayIn } from "@/lib/format";
import { PrintButton } from "./_components/print-button";
import { loadSignInSheet } from "./data";

export const metadata: Metadata = { title: "Sign-in sheet" };

const STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  completed: { label: "Completed", tone: "neutral" },
};

export default async function SignInSheetPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const auth = await requireAuth("signInSheet");
  const sp = await searchParams;
  const tz = auth.org.timezone;
  const c24 = auth.settings.clock24h;
  const today = todayIn(tz);
  const date = parseYmd(sp.date, today);
  const canAssign = can(auth.employee.role, "signInSheetAssign");

  const [shifts, options] = await Promise.all([loadSignInSheet(auth, date), canAssign ? loadAssignOptions(auth) : null]);
  const t = (v: string | null) => (v ? fmtTime(v, tz, c24) : "-");
  const dash = <span className="text-muted">-</span>;

  return (
    <>
      <PrintStyles />
      <LiveRefresh organizationId={auth.org.id} tables={["shifts"]} />
      <PageHeader
        title="Sign-in sheet"
        description={`${fmtLocalDate(date, "EEEE, MMMM d, yyyy")} · ${shifts.length} shift${shifts.length === 1 ? "" : "s"}. Employees sign in with their PIN at the kiosk.`}
        actions={
          <>
            <DateNav basePath="/sign-in-sheet" date={date} today={today} />
            <a href={`/sign-in-sheet/export?date=${date}`} className={cn(buttonVariants({ variant: "secondary" }), "print:hidden")}>
              <Download />
              Export CSV
            </a>
            <span className="print:hidden">
              <PrintButton />
            </span>
          </>
        }
      />
      <Card className="print:border-0">
        {shifts.length === 0 ? (
          <EmptyState
            icon={Signature}
            title={`No sign-ins for ${fmtLocalDate(date)}`}
            description="Shifts appear here as soon as people clock in at the kiosk."
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Sen#</TH>
                <TH>Name</TH>
                <TH>Scheduled</TH>
                <TH>Actual in</TH>
                <TH>Actual out</TH>
                <TH>Bus</TH>
                <TH>Tablet</TH>
                <TH>Status</TH>
                <TH>Radio</TH>
                <TH>Signature</TH>
                {canAssign ? (
                  <TH className="print:hidden">
                    <span className="sr-only">Assign</span>
                  </TH>
                ) : null}
              </tr>
            </THead>
            <TBody>
              {shifts.map((s) => {
                const st = STATUS[s.status] ?? { label: s.status, tone: "neutral" as Tone };
                const name = fullName(s.employee);
                return (
                  <TR key={s.id}>
                    <TD className="tabular text-xs text-muted">{s.employee.seniority_number ?? "-"}</TD>
                    <TD>
                      <p className="whitespace-nowrap font-medium">{name}</p>
                      <p className="text-xs text-muted">#{s.employee.employee_number}</p>
                    </TD>
                    <TD className="tabular whitespace-nowrap text-muted">
                      {t(s.scheduled_start)} – {t(s.scheduled_end)}
                    </TD>
                    <TD className="tabular whitespace-nowrap">{t(s.clock_in_at)}</TD>
                    <TD className="tabular whitespace-nowrap">{t(s.clock_out_at)}</TD>
                    <TD className="whitespace-nowrap">
                      {s.vehicle ? (
                        <>
                          <span className="font-mono font-semibold">{s.vehicle.number}</span>{" "}
                          <span className="text-xs capitalize text-muted">{s.vehicle.powertrain}</span>
                        </>
                      ) : (
                        dash
                      )}
                    </TD>
                    <TD>{s.tablet?.number ?? dash}</TD>
                    <TD className="whitespace-nowrap">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {s.meal_waived ? (
                        <Badge tone="warning" className="ml-1" title="Meal break waiver on file">
                          LW
                        </Badge>
                      ) : null}
                    </TD>
                    <TD>{s.radio_status ? <span className="font-mono text-xs">{s.radio_status}</span> : dash}</TD>
                    <TD className="whitespace-nowrap text-xs text-muted">
                      {s.device ? `PIN at kiosk ${s.device.name}` : s.kiosk_in_device_id ? "PIN at kiosk" : "Entered by admin"}
                    </TD>
                    {canAssign && options ? (
                      <TD className="print:hidden">
                        <AssignDialog
                          compact
                          timeZone={tz}
                          options={options}
                          shift={{
                            id: s.id,
                            employeeName: name,
                            active: s.status === "active",
                            vehicle_id: s.vehicle_id,
                            tablet_id: s.tablet_id,
                            route_id: s.route_id,
                            scheduled_start: s.scheduled_start,
                            scheduled_end: s.scheduled_end,
                          }}
                        />
                      </TD>
                    ) : null}
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
