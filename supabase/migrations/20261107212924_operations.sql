-- Operations: passenger counting, airlines and assist requests (wheelchair
-- "10-51" in v0), announcements (the overtime banner), emergencies, lost and
-- found, safety meetings.

-- ---------------------------------------------------------------------------
-- Passenger counting sheets. Columns are the org's count locations.
-- rows: [{departure_time: "HH:MM", counts: {"<location_id>": n}}]
-- ---------------------------------------------------------------------------
create table public.count_sheets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shift_id uuid not null unique references public.shifts(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  route_id uuid references public.routes(id) on delete set null,
  work_date date not null,
  rows jsonb not null default '[]'::jsonb check (jsonb_typeof(rows) = 'array'),
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index count_sheets_org_date_idx on public.count_sheets (organization_id, work_date desc);
create index count_sheets_employee_idx on public.count_sheets (employee_id);
create index count_sheets_vehicle_idx on public.count_sheets (vehicle_id);
create index count_sheets_route_idx on public.count_sheets (route_id);
create trigger count_sheets_touch before update on public.count_sheets
  for each row execute function private.touch_updated_at();

create table public.count_sheet_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sheet_id uuid not null references public.count_sheets(id) on delete cascade,
  previous_rows jsonb not null,
  new_rows jsonb not null,
  reason text not null check (length(reason) between 1 and 500),
  edited_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now()
);
create index count_sheet_revisions_sheet_idx on public.count_sheet_revisions (sheet_id);
create index count_sheet_revisions_org_idx on public.count_sheet_revisions (organization_id);
create index count_sheet_revisions_by_idx on public.count_sheet_revisions (edited_by);

-- ---------------------------------------------------------------------------
-- Airlines and assist requests
-- ---------------------------------------------------------------------------
create table public.airlines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  iata_code text check (iata_code ~ '^[A-Z0-9]{2,3}$'),
  location_id uuid references public.locations(id) on delete set null,
  phone text,
  assist_contact text,
  notes text check (length(notes) <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);
create index airlines_location_idx on public.airlines (location_id);

create table public.assist_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  airline_id uuid references public.airlines(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  assist_type text not null default 'wheelchair' check (assist_type in ('wheelchair', 'medical', 'unaccompanied', 'other')),
  passenger_name text not null check (length(passenger_name) between 1 and 120),
  flight_number text check (length(flight_number) <= 12),
  passenger_count smallint not null default 1 check (passenger_count between 1 and 20),
  notes text check (length(notes) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'acknowledged', 'resolved', 'escalated', 'cancelled')),
  response text check (length(response) <= 1000),
  responded_by uuid references public.employees(id) on delete set null,
  responded_at timestamptz,
  escalated_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assist_requests_org_status_idx on public.assist_requests (organization_id, status, created_at desc);
create index assist_requests_employee_idx on public.assist_requests (employee_id);
create index assist_requests_shift_idx on public.assist_requests (shift_id);
create index assist_requests_vehicle_idx on public.assist_requests (vehicle_id);
create index assist_requests_airline_idx on public.assist_requests (airline_id);
create index assist_requests_location_idx on public.assist_requests (location_id);
create index assist_requests_responded_by_idx on public.assist_requests (responded_by);
create trigger assist_requests_touch before update on public.assist_requests
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Announcements (the overtime banner is kind = 'overtime')
-- ---------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null default 'general' check (kind in ('general', 'overtime')),
  message text not null check (length(message) between 1 and 500),
  active boolean not null default true,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index announcements_org_active_idx on public.announcements (organization_id) where active;
create index announcements_created_by_idx on public.announcements (created_by);
create trigger announcements_touch before update on public.announcements
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Emergencies: one active per organization; everyone must acknowledge.
-- ---------------------------------------------------------------------------
create table public.emergencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('weather', 'airport', 'reroute', 'security', 'custom')),
  title text not null check (length(title) between 1 and 120),
  message text not null check (length(message) between 1 and 2000),
  active boolean not null default true,
  triggered_by uuid references public.employees(id) on delete set null,
  resolved_by uuid references public.employees(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index emergencies_one_active on public.emergencies (organization_id) where active;
create index emergencies_org_time_idx on public.emergencies (organization_id, created_at desc);
create index emergencies_triggered_by_idx on public.emergencies (triggered_by);
create index emergencies_resolved_by_idx on public.emergencies (resolved_by);

create table public.emergency_acks (
  emergency_id uuid not null references public.emergencies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  acked_at timestamptz not null default now(),
  primary key (emergency_id, employee_id)
);
create index emergency_acks_employee_idx on public.emergency_acks (employee_id);
create index emergency_acks_org_idx on public.emergency_acks (organization_id);

-- ---------------------------------------------------------------------------
-- Lost and found
-- ---------------------------------------------------------------------------
create table public.lost_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reference text not null default upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6)),
  description text not null check (length(description) between 1 and 500),
  category text not null default 'other' check (category in ('bag', 'electronics', 'document', 'clothing', 'jewelry', 'other')),
  contents text check (length(contents) <= 2000),
  found_at timestamptz not null default now(),
  found_location_id uuid references public.locations(id) on delete set null,
  found_vehicle_id uuid references public.vehicles(id) on delete set null,
  found_by uuid references public.employees(id) on delete set null,
  status text not null default 'found' check (status in ('found', 'collected', 'at_dispatch', 'claimed', 'disposed')),
  custody_by uuid references public.employees(id) on delete set null,
  claimant_name text check (length(claimant_name) <= 120),
  claimant_contact text check (length(claimant_contact) <= 120),
  -- Last 4 characters of the ID shown at pickup (never the full number).
  claimant_id_last4 text check (claimant_id_last4 ~ '^[A-Za-z0-9]{1,4}$'),
  disposal_reason text check (length(disposal_reason) <= 500),
  closed_at timestamptz,
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference),
  check (status <> 'claimed' or claimant_name is not null),
  check (status <> 'disposed' or disposal_reason is not null)
);
create index lost_items_org_status_idx on public.lost_items (organization_id, status, found_at desc);
create index lost_items_location_idx on public.lost_items (found_location_id);
create index lost_items_vehicle_idx on public.lost_items (found_vehicle_id);
create index lost_items_found_by_idx on public.lost_items (found_by);
create index lost_items_custody_idx on public.lost_items (custody_by);
create trigger lost_items_touch before update on public.lost_items
  for each row execute function private.touch_updated_at();

create table public.lost_item_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_id uuid not null references public.lost_items(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid references public.employees(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index lost_item_events_item_idx on public.lost_item_events (item_id, created_at);
create index lost_item_events_org_idx on public.lost_item_events (organization_id);
create index lost_item_events_actor_idx on public.lost_item_events (actor_id);

-- Allowed lost-item transitions; history row with the acting employee.
create or replace function private.lost_item_transition()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'found' and new.status in ('collected', 'at_dispatch', 'claimed', 'disposed')) or
      (old.status = 'collected' and new.status in ('at_dispatch', 'claimed', 'disposed')) or
      (old.status = 'at_dispatch' and new.status in ('claimed', 'disposed'))
    ) then
      raise exception 'Cannot move a lost item from % to %', old.status, new.status using errcode = 'P0001';
    end if;
    if new.status in ('claimed', 'disposed') then new.closed_at := now(); end if;
    select e.id into actor from public.employees e
      where e.user_id = (select auth.uid()) and e.organization_id = new.organization_id limit 1;
    insert into public.lost_item_events (organization_id, item_id, from_status, to_status, actor_id)
      values (new.organization_id, new.id, old.status, new.status, actor);
  end if;
  return new;
end $$;
create trigger lost_items_transition before update on public.lost_items
  for each row execute function private.lost_item_transition();

-- ---------------------------------------------------------------------------
-- Safety meetings
-- ---------------------------------------------------------------------------
create table public.safety_meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  -- Empty array = everyone.
  audience public.app_role[] not null default '{}',
  starts_at timestamptz not null,
  duration_minutes smallint not null default 30 check (duration_minutes between 5 and 480),
  location text check (length(location) <= 120),
  notes text check (length(notes) <= 2000),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now()
);
create index safety_meetings_org_time_idx on public.safety_meetings (organization_id, starts_at);
create index safety_meetings_created_by_idx on public.safety_meetings (created_by);

create table public.safety_attendance (
  meeting_id uuid not null references public.safety_meetings(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null check (status in ('present', 'late', 'absent', 'excused')),
  signed_in_at timestamptz,
  recorded_by uuid references public.employees(id) on delete set null,
  note text check (length(note) <= 500),
  primary key (meeting_id, employee_id)
);
create index safety_attendance_employee_idx on public.safety_attendance (employee_id);
create index safety_attendance_org_idx on public.safety_attendance (organization_id);
create index safety_attendance_recorded_by_idx on public.safety_attendance (recorded_by);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.count_sheets enable row level security;
alter table public.count_sheet_revisions enable row level security;
alter table public.airlines enable row level security;
alter table public.assist_requests enable row level security;
alter table public.announcements enable row level security;
alter table public.emergencies enable row level security;
alter table public.emergency_acks enable row level security;
alter table public.lost_items enable row level security;
alter table public.lost_item_events enable row level security;
alter table public.safety_meetings enable row level security;
alter table public.safety_attendance enable row level security;

create policy count_sheets_select on public.count_sheets for select to authenticated
  using (employee_id in (select private.my_employee_ids())
         or organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher,coordinator}')));
create policy count_sheets_insert_own on public.count_sheets for insert to authenticated
  with check (employee_id in (select private.my_employee_ids()) and status = 'draft'
              and exists (select 1 from public.shifts s where s.id = shift_id
                          and s.employee_id = count_sheets.employee_id and s.status = 'active'));
create policy count_sheets_update_own on public.count_sheets for update to authenticated
  using (employee_id in (select private.my_employee_ids()) and status = 'draft')
  with check (employee_id in (select private.my_employee_ids()));
create policy count_sheets_staff_update on public.count_sheets for update to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}')))
  with check (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}')));
create policy count_revisions_select on public.count_sheet_revisions for select to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher,coordinator}')));
create policy count_revisions_insert on public.count_sheet_revisions for insert to authenticated
  with check (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}'))
              and edited_by in (select private.my_employee_ids()));

create policy airlines_select on public.airlines for select to authenticated
  using (organization_id in (select private.org_ids()));
create policy airlines_admin on public.airlines for all to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')))
  with check (organization_id in (select private.org_ids_with_role('{admin}')));

create policy assists_select on public.assist_requests for select to authenticated
  using (employee_id in (select private.my_employee_ids())
         or organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher,coordinator}')));
create policy assists_insert_own on public.assist_requests for insert to authenticated
  with check (employee_id in (select private.my_employee_ids()) and status = 'pending'
              and organization_id in (select private.org_ids()));
create policy assists_cancel_own on public.assist_requests for update to authenticated
  using (employee_id in (select private.my_employee_ids()) and status in ('pending', 'escalated'))
  with check (employee_id in (select private.my_employee_ids()) and status = 'cancelled');
create policy assists_ops_update on public.assist_requests for update to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}')))
  with check (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}')));

create policy announcements_select on public.announcements for select to authenticated
  using (organization_id in (select private.org_ids()));
create policy announcements_ops on public.announcements for all to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}')))
  with check (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}')));

create policy emergencies_select on public.emergencies for select to authenticated
  using (organization_id in (select private.org_ids()));
create policy emergencies_trigger on public.emergencies for insert to authenticated
  with check (organization_id in (select private.org_ids_with_role('{admin,supervisor}'))
              and triggered_by in (select private.my_employee_ids()));
create policy emergencies_resolve on public.emergencies for update to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor}')))
  with check (organization_id in (select private.org_ids_with_role('{admin,supervisor}')));
create policy emergency_acks_select on public.emergency_acks for select to authenticated
  using (employee_id in (select private.my_employee_ids())
         or organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher,coordinator}')));
create policy emergency_acks_insert_own on public.emergency_acks for insert to authenticated
  with check (employee_id in (select private.my_employee_ids())
              and exists (select 1 from public.emergencies e where e.id = emergency_id
                          and e.organization_id = emergency_acks.organization_id));

create policy lost_items_select on public.lost_items for select to authenticated
  using (found_by in (select private.my_employee_ids())
         or organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher,coordinator}')));
create policy lost_items_insert on public.lost_items for insert to authenticated
  with check (organization_id in (select private.org_ids()) and status = 'found'
              and found_by in (select private.my_employee_ids()));
create policy lost_items_update on public.lost_items for update to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher,coordinator}')))
  with check (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher,coordinator}')));
create policy lost_item_events_select on public.lost_item_events for select to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher,coordinator}')));

create policy safety_select on public.safety_meetings for select to authenticated
  using (organization_id in (select private.org_ids()));
create policy safety_admin on public.safety_meetings for all to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor}')))
  with check (organization_id in (select private.org_ids_with_role('{admin,supervisor}')));
create policy attendance_select on public.safety_attendance for select to authenticated
  using (employee_id in (select private.my_employee_ids())
         or organization_id in (select private.org_ids_with_role('{admin,supervisor,coordinator}')));
create policy attendance_staff on public.safety_attendance for all to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor,coordinator}')))
  with check (organization_id in (select private.org_ids_with_role('{admin,supervisor,coordinator}')));
-- Self sign-in goes through public.safety_sign_in (RPC) which sets present/late.
