-- Fleet: locations, routes, vehicles, tablets, radio codes, GPS, inspections,
-- defects, fuel log and end-of-shift reports. Everything that was hardcoded for
-- one airport in v0 (terminals, counting columns, radio codes, checklist) is a
-- per-organization row here.

create type public.vehicle_status as enum (
  'ready', 'in_service', 'charging', 'needs_fuel', 'needs_wash', 'needs_fuel_wash',
  'pmi', 'shop', 'repair', 'safety_hold', 'training', 'retired'
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  code text not null check (code ~ '^[A-Za-z0-9_-]{1,12}$'),
  kind text not null default 'terminal' check (kind in ('terminal', 'depot', 'rental_car', 'stop', 'other')),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  radius_m integer not null default 200 check (radius_m between 10 and 5000),
  -- Shown as a column on the passenger counting sheet.
  is_count_column boolean not null default false,
  sort integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  color text not null default '#095FFC' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  stop_ids uuid[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  number text not null check (length(number) between 1 and 20),
  vehicle_type text not null default 'bus' check (length(vehicle_type) between 1 and 40),
  powertrain text not null default 'diesel' check (powertrain in ('diesel', 'ev', 'gasoline', 'cng', 'hybrid')),
  status public.vehicle_status not null default 'ready',
  -- Fuel or battery level in percent.
  energy_level smallint check (energy_level between 0 and 100),
  odometer integer check (odometer >= 0),
  capacity smallint check (capacity between 1 and 200),
  vin text check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  plate text,
  notes text check (length(notes) <= 2000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, number)
);
create index vehicles_org_status_idx on public.vehicles (organization_id, status) where active;
create trigger vehicles_touch before update on public.vehicles
  for each row execute function private.touch_updated_at();

create table public.vehicle_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  from_status public.vehicle_status,
  to_status public.vehicle_status not null,
  changed_by uuid references public.employees(id) on delete set null,
  reason text,
  energy_level smallint,
  odometer integer,
  created_at timestamptz not null default now()
);
create index vehicle_status_history_vehicle_idx on public.vehicle_status_history (vehicle_id, created_at desc);
create index vehicle_status_history_org_idx on public.vehicle_status_history (organization_id);
create index vehicle_status_history_changed_by_idx on public.vehicle_status_history (changed_by);

-- The actor comes from the session (auth.uid) or, for service-role writes, from
-- the transaction setting rolecall.actor / rolecall.reason set by the RPC.
create or replace function private.log_vehicle_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
begin
  if new.status is distinct from old.status then
    actor := nullif(current_setting('rolecall.actor', true), '')::uuid;
    if actor is null then
      select e.id into actor from public.employees e
        where e.user_id = (select auth.uid()) and e.organization_id = new.organization_id limit 1;
    end if;
    insert into public.vehicle_status_history
      (organization_id, vehicle_id, from_status, to_status, changed_by, reason, energy_level, odometer)
    values (new.organization_id, new.id, old.status, new.status, actor,
            nullif(current_setting('rolecall.reason', true), ''), new.energy_level, new.odometer);
  end if;
  return new;
end $$;
create trigger vehicles_status_history after update of status on public.vehicles
  for each row execute function private.log_vehicle_status();

create table public.tablets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  number text not null check (length(number) between 1 and 20),
  serial text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, number)
);

create table public.radio_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (length(code) between 1 and 12),
  label text not null check (length(label) between 1 and 60),
  sets_vehicle_status public.vehicle_status,
  notify_roles public.app_role[] not null default '{}',
  is_alert boolean not null default false,
  driver_selectable boolean not null default true,
  sort integer not null default 0,
  active boolean not null default true,
  unique (organization_id, code)
);

-- Shift assignments (vehicle, tablet, route) are set by dispatch.
alter table public.shifts
  add column vehicle_id uuid references public.vehicles(id) on delete set null,
  add column tablet_id uuid references public.tablets(id) on delete set null,
  add column route_id uuid references public.routes(id) on delete set null;
create index shifts_vehicle_idx on public.shifts (vehicle_id);
create index shifts_tablet_idx on public.shifts (tablet_id);
create index shifts_route_idx on public.shifts (route_id);
-- A vehicle or tablet can be on only one open shift.
create unique index shifts_one_open_per_vehicle on public.shifts (vehicle_id)
  where status = 'active' and vehicle_id is not null;
create unique index shifts_one_open_per_tablet on public.shifts (tablet_id)
  where status = 'active' and tablet_id is not null;

-- ---------------------------------------------------------------------------
-- GPS
-- ---------------------------------------------------------------------------
create table public.vehicle_positions (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  shift_id uuid references public.shifts(id) on delete set null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  speed_mps real check (speed_mps >= 0),
  heading real check (heading between 0 and 360),
  accuracy_m real check (accuracy_m >= 0),
  recorded_at timestamptz not null default now()
);
create index vehicle_positions_vehicle_time_idx on public.vehicle_positions (vehicle_id, recorded_at desc);
create index vehicle_positions_recorded_brin on public.vehicle_positions using brin (recorded_at);
create index vehicle_positions_org_idx on public.vehicle_positions (organization_id);
create index vehicle_positions_employee_idx on public.vehicle_positions (employee_id);
create index vehicle_positions_shift_idx on public.vehicle_positions (shift_id);

create table public.vehicle_latest_positions (
  vehicle_id uuid primary key references public.vehicles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  shift_id uuid references public.shifts(id) on delete set null,
  lat double precision not null,
  lng double precision not null,
  speed_mps real,
  heading real,
  accuracy_m real,
  recorded_at timestamptz not null
);
create index vehicle_latest_positions_org_idx on public.vehicle_latest_positions (organization_id);
create index vehicle_latest_positions_employee_idx on public.vehicle_latest_positions (employee_id);
create index vehicle_latest_positions_shift_idx on public.vehicle_latest_positions (shift_id);

create or replace function private.upsert_latest_position()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.vehicle_latest_positions as l
    (vehicle_id, organization_id, employee_id, shift_id, lat, lng, speed_mps, heading, accuracy_m, recorded_at)
  values (new.vehicle_id, new.organization_id, new.employee_id, new.shift_id, new.lat, new.lng,
          new.speed_mps, new.heading, new.accuracy_m, new.recorded_at)
  on conflict (vehicle_id) do update set
    employee_id = excluded.employee_id, shift_id = excluded.shift_id, lat = excluded.lat,
    lng = excluded.lng, speed_mps = excluded.speed_mps, heading = excluded.heading,
    accuracy_m = excluded.accuracy_m, recorded_at = excluded.recorded_at
  where l.recorded_at <= excluded.recorded_at;
  return new;
end $$;
create trigger vehicle_positions_latest after insert on public.vehicle_positions
  for each row execute function private.upsert_latest_position();

-- ---------------------------------------------------------------------------
-- Inspections (DVIR), defects, fuel log, end of shift
-- ---------------------------------------------------------------------------
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category text not null check (length(category) between 1 and 60),
  label text not null check (length(label) between 1 and 120),
  -- A failed critical item puts the vehicle in the shop.
  critical boolean not null default false,
  sort integer not null default 0,
  active boolean not null default true
);
create index checklist_items_org_idx on public.checklist_items (organization_id, sort);

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  kind text not null check (kind in ('pre_trip', 'post_trip')),
  odometer integer check (odometer >= 0),
  -- [{item_id, category, label, critical, ok: true|false|null, note}]
  results jsonb not null default '[]'::jsonb check (jsonb_typeof(results) = 'array'),
  -- Damage diagram: vector strokes normalised 0..1 per view.
  damage jsonb not null default '[]'::jsonb check (jsonb_typeof(damage) = 'array'),
  notes text check (length(notes) <= 2000),
  defect_count smallint not null default 0,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shift_id, kind)
);
create index inspections_org_time_idx on public.inspections (organization_id, created_at desc);
create index inspections_vehicle_idx on public.inspections (vehicle_id, created_at desc);
create index inspections_employee_idx on public.inspections (employee_id);
create trigger inspections_touch before update on public.inspections
  for each row execute function private.touch_updated_at();

create table public.defects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  inspection_id uuid references public.inspections(id) on delete set null,
  reported_by uuid references public.employees(id) on delete set null,
  category text not null check (length(category) between 1 and 60),
  item text not null check (length(item) between 1 and 120),
  description text check (length(description) <= 2000),
  severity text not null default 'minor' check (severity in ('minor', 'major', 'critical')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'deferred')),
  assigned_to uuid references public.employees(id) on delete set null,
  resolution_note text check (length(resolution_note) <= 2000),
  resolved_by uuid references public.employees(id) on delete set null,
  resolved_at timestamptz,
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'resolved' or resolved_at is not null)
);
create index defects_org_status_idx on public.defects (organization_id, status);
create index defects_vehicle_idx on public.defects (vehicle_id);
create index defects_inspection_idx on public.defects (inspection_id);
create index defects_reported_by_idx on public.defects (reported_by);
create index defects_assigned_to_idx on public.defects (assigned_to);
create index defects_resolved_by_idx on public.defects (resolved_by);
create trigger defects_touch before update on public.defects
  for each row execute function private.touch_updated_at();

create table public.fuel_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  service text not null check (service in ('fuel', 'wash', 'charge')),
  energy_before smallint check (energy_before between 0 and 100),
  energy_after smallint check (energy_after between 0 and 100),
  quantity numeric(8, 2) check (quantity >= 0),
  odometer integer check (odometer >= 0),
  notes text check (length(notes) <= 1000),
  created_at timestamptz not null default now()
);
create index fuel_logs_org_time_idx on public.fuel_logs (organization_id, created_at desc);
create index fuel_logs_vehicle_idx on public.fuel_logs (vehicle_id);
create index fuel_logs_employee_idx on public.fuel_logs (employee_id);

create table public.end_of_shift_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shift_id uuid not null unique references public.shifts(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  energy_level smallint check (energy_level between 0 and 100),
  condition text not null check (condition in ('ready', 'needs_charge', 'needs_fuel', 'shop', 'hazard')),
  odometer integer check (odometer >= 0),
  notes text check (length(notes) <= 2000),
  created_at timestamptz not null default now()
);
create index eos_org_time_idx on public.end_of_shift_reports (organization_id, created_at desc);
create index eos_employee_idx on public.end_of_shift_reports (employee_id);
create index eos_vehicle_idx on public.end_of_shift_reports (vehicle_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.locations enable row level security;
alter table public.routes enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_status_history enable row level security;
alter table public.tablets enable row level security;
alter table public.radio_codes enable row level security;
alter table public.vehicle_positions enable row level security;
alter table public.vehicle_latest_positions enable row level security;
alter table public.checklist_items enable row level security;
alter table public.inspections enable row level security;
alter table public.defects enable row level security;
alter table public.fuel_logs enable row level security;
alter table public.end_of_shift_reports enable row level security;

-- Reference data: readable by every member, written by admin.
create policy locations_select on public.locations for select to authenticated
  using (organization_id in (select private.org_ids()));
create policy locations_admin on public.locations for all to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')))
  with check (organization_id in (select private.org_ids_with_role('{admin}')));
create policy routes_select on public.routes for select to authenticated
  using (organization_id in (select private.org_ids()));
create policy routes_admin on public.routes for all to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')))
  with check (organization_id in (select private.org_ids_with_role('{admin}')));
create policy tablets_select on public.tablets for select to authenticated
  using (organization_id in (select private.org_ids()));
create policy tablets_admin on public.tablets for all to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')))
  with check (organization_id in (select private.org_ids_with_role('{admin}')));
create policy radio_codes_select on public.radio_codes for select to authenticated
  using (organization_id in (select private.org_ids()));
create policy radio_codes_admin on public.radio_codes for all to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')))
  with check (organization_id in (select private.org_ids_with_role('{admin}')));
create policy checklist_select on public.checklist_items for select to authenticated
  using (organization_id in (select private.org_ids()));
create policy checklist_admin on public.checklist_items for all to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')))
  with check (organization_id in (select private.org_ids_with_role('{admin}')));

-- Vehicles: every member reads; admin creates; ops, fuelers and technicians
-- change status through the app (field roles go through RPCs).
create policy vehicles_select on public.vehicles for select to authenticated
  using (organization_id in (select private.org_ids()));
create policy vehicles_insert on public.vehicles for insert to authenticated
  with check (organization_id in (select private.org_ids_with_role('{admin}')));
create policy vehicles_update on public.vehicles for update to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher,technician,fueler}')))
  with check (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher,technician,fueler}')));
create policy vehicles_delete on public.vehicles for delete to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')));
create policy vehicle_history_select on public.vehicle_status_history for select to authenticated
  using (organization_id in (select private.org_ids()));

-- GPS: positions are written only through public.record_position (RPC).
create policy positions_select on public.vehicle_positions for select to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}')));
create policy latest_positions_select on public.vehicle_latest_positions for select to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher,coordinator}'))
         or employee_id in (select private.my_employee_ids()));

-- Inspections: drivers own theirs while unsubmitted; staff and technicians read.
create policy inspections_select on public.inspections for select to authenticated
  using (employee_id in (select private.my_employee_ids())
         or organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher,coordinator,technician}')));
create policy inspections_insert_own on public.inspections for insert to authenticated
  with check (employee_id in (select private.my_employee_ids())
              and submitted_at is null
              and exists (select 1 from public.shifts s where s.id = shift_id
                          and s.employee_id = inspections.employee_id and s.status = 'active'
                          and s.vehicle_id = inspections.vehicle_id));
create policy inspections_update_own on public.inspections for update to authenticated
  using (employee_id in (select private.my_employee_ids()) and submitted_at is null)
  with check (employee_id in (select private.my_employee_ids()) and submitted_at is null);
create policy inspections_admin on public.inspections for all to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')))
  with check (organization_id in (select private.org_ids_with_role('{admin}')));

-- Defects: anyone in the org can report one; technicians and ops work them.
create policy defects_select on public.defects for select to authenticated
  using (organization_id in (select private.org_ids()));
create policy defects_insert on public.defects for insert to authenticated
  with check (organization_id in (select private.org_ids())
              and reported_by in (select private.my_employee_ids()));
create policy defects_update on public.defects for update to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor,technician}')))
  with check (organization_id in (select private.org_ids_with_role('{admin,supervisor,technician}')));

create policy fuel_select on public.fuel_logs for select to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher,fueler,technician}')));
create policy fuel_insert on public.fuel_logs for insert to authenticated
  with check (organization_id in (select private.org_ids_with_role('{admin,supervisor,fueler}'))
              and employee_id in (select private.my_employee_ids()));

create policy eos_select on public.end_of_shift_reports for select to authenticated
  using (employee_id in (select private.my_employee_ids())
         or organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher,coordinator}')));
