-- Time records (shifts), breaks, pay periods, leave ledger and fatigue alerts.
-- A shift is created by a kiosk clock-in (or by an admin) and closed by a
-- clock-out. Planned breaks are calculated in lib/labor and stored with
-- their windows so the break monitor only has to compare timestamps.

create type public.shift_status as enum ('active', 'completed', 'void');
create type public.break_kind as enum ('rest', 'meal');
create type public.break_status as enum ('planned', 'active', 'completed', 'missed', 'overrun', 'waived');

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  -- Local calendar date of the clock-in in the organization time zone.
  work_date date not null,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  status public.shift_status not null default 'active',
  source_in text not null default 'kiosk' check (source_in in ('kiosk', 'admin')),
  source_out text check (source_out in ('kiosk', 'admin')),
  kiosk_in_device_id uuid references public.kiosk_devices(id) on delete set null,
  kiosk_out_device_id uuid references public.kiosk_devices(id) on delete set null,
  radio_status text,
  radio_status_at timestamptz,
  meal_waived boolean not null default false,
  compliance_verdict text check (compliance_verdict in ('ok', 'flag')),
  compliance_note text check (length(compliance_note) <= 2000),
  compliance_by uuid references public.employees(id) on delete set null,
  compliance_at timestamptz,
  notes text check (length(notes) <= 2000),
  edited_by uuid references public.employees(id) on delete set null,
  edit_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (clock_out_at is null or clock_out_at > clock_in_at),
  check (status <> 'active' or clock_out_at is null),
  check (status <> 'completed' or clock_out_at is not null),
  check (scheduled_end is null or scheduled_start is null or scheduled_end > scheduled_start),
  -- No overlapping time records for one employee.
  constraint shifts_no_overlap exclude using gist (
    employee_id with =,
    tstzrange(clock_in_at, coalesce(clock_out_at, 'infinity'::timestamptz), '[)') with &&
  ) where (status <> 'void')
);
create unique index shifts_one_open_per_employee on public.shifts (employee_id) where status = 'active';
create index shifts_org_date_idx on public.shifts (organization_id, work_date desc);
create index shifts_org_active_idx on public.shifts (organization_id) where status = 'active';
create index shifts_employee_time_idx on public.shifts (employee_id, clock_in_at desc);
create index shifts_compliance_by_idx on public.shifts (compliance_by);
create index shifts_edited_by_idx on public.shifts (edited_by);
create index shifts_kiosk_in_idx on public.shifts (kiosk_in_device_id);
create index shifts_kiosk_out_idx on public.shifts (kiosk_out_device_id);
create trigger shifts_touch before update on public.shifts
  for each row execute function private.touch_updated_at();

create table public.breaks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  kind public.break_kind not null,
  paid boolean not null,
  sequence smallint not null check (sequence between 1 and 12),
  planned_minutes smallint not null check (planned_minutes between 1 and 120),
  window_start timestamptz,
  window_end timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  status public.break_status not null default 'planned',
  reminder_sent_at timestamptz,
  overrun_alerted_at timestamptz,
  missed_alerted_at timestamptz,
  reopened_by uuid references public.employees(id) on delete set null,
  reopened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shift_id, kind, sequence),
  check (ended_at is null or (started_at is not null and ended_at >= started_at)),
  check (window_end is null or window_start is null or window_end >= window_start)
);
create unique index breaks_one_open_per_employee on public.breaks (employee_id)
  where started_at is not null and ended_at is null;
create index breaks_org_status_idx on public.breaks (organization_id, status);
create index breaks_shift_idx on public.breaks (shift_id);
create index breaks_reopened_by_idx on public.breaks (reopened_by);
create trigger breaks_touch before update on public.breaks
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Payroll
-- ---------------------------------------------------------------------------
create table public.pay_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  pay_date date,
  status text not null default 'open' check (status in ('open', 'locked')),
  locked_at timestamptz,
  locked_by uuid references public.employees(id) on delete set null,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 31),
  constraint pay_periods_no_overlap exclude using gist (
    organization_id with =, daterange(starts_on, ends_on, '[]') with &&
  )
);
create index pay_periods_locked_by_idx on public.pay_periods (locked_by);
create index pay_periods_created_by_idx on public.pay_periods (created_by);
create trigger pay_periods_touch before update on public.pay_periods
  for each row execute function private.touch_updated_at();

create table public.pay_period_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pay_period_id uuid not null references public.pay_periods(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  regular_minutes integer not null default 0,
  daily_ot_minutes integer not null default 0,
  weekly_ot_minutes integer not null default 0,
  paid_break_minutes integer not null default 0,
  unpaid_break_minutes integer not null default 0,
  leave_minutes integer not null default 0,
  pay_rate_cents integer not null default 0,
  regular_cents bigint not null default 0,
  overtime_cents bigint not null default 0,
  gross_cents bigint not null default 0,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (pay_period_id, employee_id)
);
create index pay_period_lines_org_idx on public.pay_period_lines (organization_id);
create index pay_period_lines_employee_idx on public.pay_period_lines (employee_id);

create table public.payroll_exports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pay_period_id uuid not null references public.pay_periods(id) on delete cascade,
  exported_by uuid references public.employees(id) on delete set null,
  row_count integer not null,
  sha256 text not null,
  created_at timestamptz not null default now()
);
create index payroll_exports_period_idx on public.payroll_exports (pay_period_id);
create index payroll_exports_org_idx on public.payroll_exports (organization_id);
create index payroll_exports_by_idx on public.payroll_exports (exported_by);

-- ---------------------------------------------------------------------------
-- Leave balances as a ledger (balance = sum of hours per kind)
-- ---------------------------------------------------------------------------
create table public.leave_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  kind text not null check (kind in ('pto', 'vacation', 'sick', 'fmla')),
  hours numeric(7, 2) not null check (hours <> 0 and abs(hours) <= 2000),
  reason text not null check (length(reason) between 1 and 500),
  form_id uuid,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now()
);
create index leave_ledger_employee_idx on public.leave_ledger (employee_id, kind);
create index leave_ledger_org_idx on public.leave_ledger (organization_id);
create index leave_ledger_created_by_idx on public.leave_ledger (created_by);

-- ---------------------------------------------------------------------------
-- Fatigue alerts (raised by lib/labor/fatigue at clock-in and clock-out)
-- ---------------------------------------------------------------------------
create table public.fatigue_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  kind text not null check (kind in ('long_shift', 'on_duty_limit', 'short_rest',
    'consecutive_days', 'weekly_hours', 'weekly_overtime')),
  severity text not null default 'warning' check (severity in ('warning', 'critical')),
  message text not null,
  detail jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references public.employees(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text check (length(resolution_note) <= 2000),
  created_at timestamptz not null default now(),
  unique (organization_id, dedupe_key)
);
create index fatigue_alerts_org_status_idx on public.fatigue_alerts (organization_id, status);
create index fatigue_alerts_employee_idx on public.fatigue_alerts (employee_id);
create index fatigue_alerts_shift_idx on public.fatigue_alerts (shift_id);
create index fatigue_alerts_resolved_by_idx on public.fatigue_alerts (resolved_by);

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

-- Time records inside a locked pay period are immutable.
create or replace function private.in_locked_period(org uuid, d date)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pay_periods p
    where p.organization_id = org and p.status = 'locked' and d between p.starts_on and p.ends_on
  )
$$;

create or replace function private.guard_locked_period()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and private.in_locked_period(old.organization_id, old.work_date) then
    raise exception 'This time record is in a locked pay period' using errcode = 'P0001';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and private.in_locked_period(new.organization_id, new.work_date) then
    raise exception 'This time record is in a locked pay period' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger shifts_locked_period before insert or update or delete on public.shifts
  for each row execute function private.guard_locked_period();

-- Which shift columns each role may change. Service-role (no auth.uid()) is the
-- kiosk and cron and is trusted.
create or replace function private.guard_shift_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if;
  -- Set (transaction-local) by SECURITY DEFINER RPCs that already checked the caller.
  if current_setting('rolecall.internal', true) = 'on' then return new; end if;
  if private.has_org_role(old.organization_id, '{admin,supervisor}') then return new; end if;
  if (new.clock_in_at, new.clock_out_at, new.status, new.employee_id, new.work_date,
      new.organization_id, new.meal_waived)
     is distinct from
     (old.clock_in_at, old.clock_out_at, old.status, old.employee_id, old.work_date,
      old.organization_id, old.meal_waived) then
    raise exception 'Only an admin or supervisor can edit clock times' using errcode = '42501';
  end if;
  if not private.has_org_role(old.organization_id, '{dispatcher}') then
    -- Coordinators may only record compliance verdicts and notes.
    if (new.scheduled_start, new.scheduled_end, new.radio_status) is distinct from
       (old.scheduled_start, old.scheduled_end, old.radio_status) then
      raise exception 'Not allowed to change this shift' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger shifts_guard_update before update on public.shifts
  for each row execute function private.guard_shift_update();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.shifts enable row level security;
alter table public.breaks enable row level security;
alter table public.pay_periods enable row level security;
alter table public.pay_period_lines enable row level security;
alter table public.payroll_exports enable row level security;
alter table public.leave_ledger enable row level security;
alter table public.fatigue_alerts enable row level security;

create policy shifts_select on public.shifts for select to authenticated
  using (employee_id in (select private.my_employee_ids())
         or organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher,coordinator}')));
create policy shifts_insert on public.shifts for insert to authenticated
  with check (organization_id in (select private.org_ids_with_role('{admin,supervisor}')));
create policy shifts_update on public.shifts for update to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher,coordinator}')))
  with check (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher,coordinator}')));
create policy shifts_delete on public.shifts for delete to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')));

create policy breaks_select on public.breaks for select to authenticated
  using (employee_id in (select private.my_employee_ids())
         or organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher,coordinator}')));
create policy breaks_write on public.breaks for all to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}')))
  with check (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}')));

create policy pay_periods_admin on public.pay_periods for all to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')))
  with check (organization_id in (select private.org_ids_with_role('{admin}')));
create policy pay_lines_admin on public.pay_period_lines for all to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')))
  with check (organization_id in (select private.org_ids_with_role('{admin}')));
create policy pay_lines_own on public.pay_period_lines for select to authenticated
  using (employee_id in (select private.my_employee_ids()));
create policy payroll_exports_admin on public.payroll_exports for all to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')))
  with check (organization_id in (select private.org_ids_with_role('{admin}')));

create policy leave_select on public.leave_ledger for select to authenticated
  using (employee_id in (select private.my_employee_ids())
         or organization_id in (select private.org_ids_with_role('{admin,supervisor}')));
create policy leave_admin on public.leave_ledger for insert to authenticated
  with check (organization_id in (select private.org_ids_with_role('{admin}')));

create policy fatigue_select on public.fatigue_alerts for select to authenticated
  using (employee_id in (select private.my_employee_ids())
         or organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}')));
create policy fatigue_insert on public.fatigue_alerts for insert to authenticated
  with check (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}')));
create policy fatigue_update on public.fatigue_alerts for update to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}')))
  with check (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}')));
