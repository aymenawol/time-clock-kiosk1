-- Scheduling: seniority shift bids and overtime offers. Forms: employee requests
-- reviewed by admins and supervisors.

-- ---------------------------------------------------------------------------
-- Shift bids
-- ---------------------------------------------------------------------------
create table public.bid_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  description text check (length(description) <= 2000),
  starts_on date not null,
  ends_on date not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'awarded')),
  max_choices smallint not null default 3 check (max_choices between 1 and 10),
  awarded_at timestamptz,
  awarded_by uuid references public.employees(id) on delete set null,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (closes_at > opens_at)
);
create index bid_cycles_org_idx on public.bid_cycles (organization_id, starts_on desc);
create index bid_cycles_awarded_by_idx on public.bid_cycles (awarded_by);
create index bid_cycles_created_by_idx on public.bid_cycles (created_by);

create table public.bid_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cycle_id uuid not null references public.bid_cycles(id) on delete cascade,
  line_number integer not null check (line_number > 0),
  start_time time not null,
  end_time time not null,
  report_time time,
  -- 0 = Sunday ... 6 = Saturday
  weekdays smallint[] not null check (weekdays <@ array[0,1,2,3,4,5,6]::smallint[] and cardinality(weekdays) > 0),
  line_type text not null default 'full_time' check (line_type in ('full_time', 'part_time', 'shuttle', 'other')),
  capacity smallint not null default 1 check (capacity between 1 and 100),
  route_id uuid references public.routes(id) on delete set null,
  notes text check (length(notes) <= 500),
  unique (cycle_id, line_number)
);
create index bid_lines_org_idx on public.bid_lines (organization_id);
create index bid_lines_route_idx on public.bid_lines (route_id);

create table public.bid_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cycle_id uuid not null references public.bid_cycles(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  line_ids uuid[] not null check (cardinality(line_ids) between 1 and 10),
  submitted_at timestamptz not null default now(),
  unique (cycle_id, employee_id)
);
create index bid_preferences_org_idx on public.bid_preferences (organization_id);
create index bid_preferences_employee_idx on public.bid_preferences (employee_id);

create table public.bid_awards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cycle_id uuid not null references public.bid_cycles(id) on delete cascade,
  line_id uuid not null references public.bid_lines(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  choice_rank smallint check (choice_rank between 1 and 10),
  method text not null check (method in ('seniority', 'manual', 'auto')),
  reason text check (length(reason) <= 500),
  awarded_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (cycle_id, employee_id)
);
create index bid_awards_org_idx on public.bid_awards (organization_id);
create index bid_awards_line_idx on public.bid_awards (line_id);
create index bid_awards_employee_idx on public.bid_awards (employee_id);
create index bid_awards_by_idx on public.bid_awards (awarded_by);

-- ---------------------------------------------------------------------------
-- Overtime offers
-- ---------------------------------------------------------------------------
create table public.ot_offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 15 and 960),
  slots smallint not null default 1 check (slots between 1 and 100),
  description text check (length(description) <= 2000),
  bid_closes_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'closed', 'awarded', 'cancelled')),
  eligible_roles public.app_role[] not null default '{driver}',
  posted_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now()
);
create index ot_offers_org_idx on public.ot_offers (organization_id, starts_at desc);
create index ot_offers_posted_by_idx on public.ot_offers (posted_by);

create table public.ot_bids (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  offer_id uuid not null references public.ot_offers(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (offer_id, employee_id)
);
create index ot_bids_org_idx on public.ot_bids (organization_id);
create index ot_bids_employee_idx on public.ot_bids (employee_id);

create table public.ot_awards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  offer_id uuid not null references public.ot_offers(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  method text not null check (method in ('seniority', 'manual')),
  awarded_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (offer_id, employee_id)
);
create index ot_awards_org_idx on public.ot_awards (organization_id);
create index ot_awards_employee_idx on public.ot_awards (employee_id);
create index ot_awards_by_idx on public.ot_awards (awarded_by);

create table public.off_day_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  message text not null check (length(message) between 1 and 1000),
  response text not null default 'pending' check (response in ('pending', 'accepted', 'declined', 'partial')),
  available_from time,
  available_hours numeric(4, 2) check (available_hours > 0 and available_hours <= 16),
  response_note text check (length(response_note) <= 500),
  responded_at timestamptz,
  sent_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now()
);
create index off_day_requests_org_idx on public.off_day_requests (organization_id, work_date desc);
create index off_day_requests_employee_idx on public.off_day_requests (employee_id);
create index off_day_requests_sent_by_idx on public.off_day_requests (sent_by);

-- ---------------------------------------------------------------------------
-- Forms
-- ---------------------------------------------------------------------------
create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  form_type text not null check (form_type in ('time_off', 'bid_vacation_change', 'incident_report', 'fmla_conversion', 'resignation')),
  -- Validated per type by lib/forms.ts.
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) < 20000),
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'denied', 'returned', 'withdrawn')),
  reviewer_id uuid references public.employees(id) on delete set null,
  reviewed_at timestamptz,
  reviewer_comment text check (length(reviewer_comment) <= 2000),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index form_submissions_org_status_idx on public.form_submissions (organization_id, status, created_at desc);
create index form_submissions_employee_idx on public.form_submissions (employee_id);
create index form_submissions_reviewer_idx on public.form_submissions (reviewer_id);
create trigger form_submissions_touch before update on public.form_submissions
  for each row execute function private.touch_updated_at();

alter table public.leave_ledger
  add constraint leave_ledger_form_fk foreign key (form_id) references public.form_submissions(id) on delete set null;
create index leave_ledger_form_idx on public.leave_ledger (form_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.bid_cycles enable row level security;
alter table public.bid_lines enable row level security;
alter table public.bid_preferences enable row level security;
alter table public.bid_awards enable row level security;
alter table public.ot_offers enable row level security;
alter table public.ot_bids enable row level security;
alter table public.ot_awards enable row level security;
alter table public.off_day_requests enable row level security;
alter table public.form_submissions enable row level security;

create policy bid_cycles_select on public.bid_cycles for select to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor}'))
         or (organization_id in (select private.org_ids()) and status <> 'draft'));
create policy bid_cycles_admin on public.bid_cycles for all to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')))
  with check (organization_id in (select private.org_ids_with_role('{admin}')));
create policy bid_lines_select on public.bid_lines for select to authenticated
  using (exists (select 1 from public.bid_cycles c where c.id = cycle_id));
create policy bid_lines_admin on public.bid_lines for all to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')))
  with check (organization_id in (select private.org_ids_with_role('{admin}')));
create policy bid_prefs_select on public.bid_preferences for select to authenticated
  using (employee_id in (select private.my_employee_ids())
         or organization_id in (select private.org_ids_with_role('{admin,supervisor}')));
-- Employees submit through public.submit_bid_preferences (window + lines checked).
create policy bid_awards_select on public.bid_awards for select to authenticated
  using (employee_id in (select private.my_employee_ids())
         or organization_id in (select private.org_ids_with_role('{admin,supervisor}')));

create policy ot_offers_select on public.ot_offers for select to authenticated
  using (organization_id in (select private.org_ids()));
create policy ot_offers_ops on public.ot_offers for all to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}')))
  with check (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}')));
create policy ot_bids_select on public.ot_bids for select to authenticated
  using (employee_id in (select private.my_employee_ids())
         or organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}')));
create policy ot_bids_insert_own on public.ot_bids for insert to authenticated
  with check (employee_id in (select private.my_employee_ids())
              and exists (select 1 from public.ot_offers o
                          join public.employees e on e.id = ot_bids.employee_id
                          where o.id = offer_id and o.organization_id = ot_bids.organization_id
                            and o.status = 'open' and o.bid_closes_at > now()
                            and (cardinality(o.eligible_roles) = 0 or e.role = any(o.eligible_roles))));
create policy ot_bids_delete_own on public.ot_bids for delete to authenticated
  using (employee_id in (select private.my_employee_ids())
         and exists (select 1 from public.ot_offers o where o.id = offer_id and o.status = 'open'));
create policy ot_awards_select on public.ot_awards for select to authenticated
  using (employee_id in (select private.my_employee_ids())
         or organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}')));

create policy off_day_select on public.off_day_requests for select to authenticated
  using (employee_id in (select private.my_employee_ids())
         or organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}')));
create policy off_day_ops on public.off_day_requests for all to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}')))
  with check (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}')));
create policy off_day_respond_own on public.off_day_requests for update to authenticated
  using (employee_id in (select private.my_employee_ids()) and response = 'pending')
  with check (employee_id in (select private.my_employee_ids()) and response <> 'pending');

create policy forms_select on public.form_submissions for select to authenticated
  using (employee_id in (select private.my_employee_ids())
         or organization_id in (select private.org_ids_with_role('{admin,supervisor}')));
create policy forms_insert_own on public.form_submissions for insert to authenticated
  with check (employee_id in (select private.my_employee_ids()) and status = 'submitted'
              and reviewer_id is null and organization_id in (select private.org_ids()));
-- Owners may resubmit a returned form, withdraw a pending one, or acknowledge a decision.
create policy forms_update_own on public.form_submissions for update to authenticated
  using (employee_id in (select private.my_employee_ids()) and status in ('submitted', 'returned', 'approved', 'denied'))
  with check (employee_id in (select private.my_employee_ids()) and status in ('submitted', 'withdrawn', 'approved', 'denied'));
-- Reviews go through public.review_form (RPC) so side effects are atomic.

-- Owners cannot change review fields or flip a decision themselves.
create or replace function private.guard_form_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if;
  if private.has_org_role(old.organization_id, '{admin,supervisor}')
     and current_setting('rolecall.reviewing', true) = 'on' then
    return new;
  end if;
  if (new.reviewer_id, new.reviewed_at, new.reviewer_comment, new.form_type, new.employee_id, new.organization_id)
     is distinct from (old.reviewer_id, old.reviewed_at, old.reviewer_comment, old.form_type, old.employee_id, old.organization_id) then
    raise exception 'Review fields can only be changed by a reviewer' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and not (
       (old.status = 'returned' and new.status = 'submitted') or
       (old.status = 'submitted' and new.status = 'withdrawn')) then
    raise exception 'Not allowed to change this request status' using errcode = '42501';
  end if;
  if new.acknowledged_at is distinct from old.acknowledged_at and old.status not in ('approved', 'denied') then
    raise exception 'Only a decided request can be acknowledged' using errcode = '42501';
  end if;
  if new.payload is distinct from old.payload and old.status <> 'returned' then
    raise exception 'Only a returned request can be edited' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger form_submissions_guard before update on public.form_submissions
  for each row execute function private.guard_form_update();
