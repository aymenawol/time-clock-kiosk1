-- RoleCall core: organizations, people, memberships, kiosk devices, audit.
-- Every tenant table carries organization_id. RLS helpers live in the private
-- schema (not exposed through PostgREST) and are SECURITY DEFINER so policies on
-- employees do not recurse.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum (
  'admin', 'supervisor', 'dispatcher', 'coordinator', 'driver', 'fueler', 'technician'
);
create type public.employee_status as enum ('active', 'on_leave', 'terminated');

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}$'),
  timezone text not null default 'America/Los_Angeles',
  labor_jurisdiction text not null default 'US-NV',
  -- Validated by the app (lib/settings.ts): break, fatigue, overtime, assist SLA,
  -- workweek and kiosk options.
  settings jsonb not null default '{}'::jsonb,
  -- Token for the public safety-meeting schedule page (/s/[token]).
  public_token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_touch before update on public.organizations
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Employees: the workforce record AND the membership (user_id is set when the
-- person can sign in on a phone or desktop).
-- ---------------------------------------------------------------------------
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  employee_number text not null check (employee_number ~ '^[0-9]{3,8}$'),
  first_name text not null check (length(first_name) between 1 and 80),
  last_name text not null check (length(last_name) between 1 and 80),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text,
  role public.app_role not null,
  status public.employee_status not null default 'active',
  job_title text,
  hire_date date,
  seniority_number integer check (seniority_number is null or seniority_number > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_number),
  unique (organization_id, user_id)
);
create index employees_org_role_idx on public.employees (organization_id, role) where status <> 'terminated';
create index employees_user_idx on public.employees (user_id) where user_id is not null;
create trigger employees_touch before update on public.employees
  for each row execute function private.touch_updated_at();

-- PIN credentials have no policies, so only the service role and SECURITY
-- DEFINER functions can read them. PINs are bcrypt hashed (pgcrypto crypt, bf).
create table public.employee_credentials (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pin_hash text,
  pin_set_at timestamptz,
  failed_count integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
create index employee_credentials_org_idx on public.employee_credentials (organization_id);

-- Compensation is admin-only (plus the employee reading their own row).
create table public.employee_compensation (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pay_rate_cents integer not null default 0 check (pay_rate_cents >= 0),
  -- NRS 608.018 daily-overtime exemption (4x10 agreement, Motor Carrier Act, CBA).
  daily_ot_exempt boolean not null default false,
  ot_exempt_reason text,
  updated_at timestamptz not null default now()
);
create index employee_compensation_org_idx on public.employee_compensation (organization_id);

-- ---------------------------------------------------------------------------
-- RLS helpers. Policies call them as `organization_id in (select private.x())`
-- so the planner evaluates them once per statement (InitPlan).
-- ---------------------------------------------------------------------------
create or replace function private.org_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select e.organization_id from public.employees e
  where e.user_id = (select auth.uid()) and e.status <> 'terminated'
$$;

create or replace function private.org_ids_with_role(roles public.app_role[])
returns setof uuid language sql stable security definer set search_path = '' as $$
  select e.organization_id from public.employees e
  where e.user_id = (select auth.uid()) and e.status <> 'terminated' and e.role = any(roles)
$$;

create or replace function private.my_employee_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select e.id from public.employees e
  where e.user_id = (select auth.uid()) and e.status <> 'terminated'
$$;

create or replace function private.my_employee(org uuid)
returns public.employees language sql stable security definer set search_path = '' as $$
  select e.* from public.employees e
  where e.user_id = (select auth.uid()) and e.organization_id = org and e.status <> 'terminated'
  limit 1
$$;

create or replace function private.has_org_role(org uuid, roles public.app_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.employees e
    where e.user_id = (select auth.uid()) and e.organization_id = org
      and e.status <> 'terminated' and e.role = any(roles)
  )
$$;

revoke all on function private.org_ids(), private.org_ids_with_role(public.app_role[]),
  private.my_employee_ids(), private.my_employee(uuid), private.has_org_role(uuid, public.app_role[])
  from public;
grant execute on function private.org_ids(), private.org_ids_with_role(public.app_role[]),
  private.my_employee_ids(), private.my_employee(uuid), private.has_org_role(uuid, public.app_role[])
  to authenticated, service_role;

-- Role sets used in policies:
--   ops   = admin, supervisor, dispatcher
--   staff = admin, supervisor, dispatcher, coordinator

-- ---------------------------------------------------------------------------
-- RLS: organizations, employees, credentials, compensation
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.employees enable row level security;
alter table public.employee_credentials enable row level security;
alter table public.employee_compensation enable row level security;

create policy organizations_select on public.organizations for select to authenticated
  using (id in (select private.org_ids()));
create policy organizations_update on public.organizations for update to authenticated
  using (id in (select private.org_ids_with_role('{admin}')))
  with check (id in (select private.org_ids_with_role('{admin}')));

create policy employees_select on public.employees for select to authenticated
  using (organization_id in (select private.org_ids()));
create policy employees_insert on public.employees for insert to authenticated
  with check (organization_id in (select private.org_ids_with_role('{admin}')));
create policy employees_update on public.employees for update to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')))
  with check (organization_id in (select private.org_ids_with_role('{admin}')));
create policy employees_delete on public.employees for delete to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')));

create policy compensation_select on public.employee_compensation for select to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}'))
         or employee_id in (select private.my_employee_ids()));
create policy compensation_write on public.employee_compensation for update to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')))
  with check (organization_id in (select private.org_ids_with_role('{admin}')));

-- An organization must always keep one active admin.
create or replace function private.protect_last_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
declare remaining int;
begin
  if (tg_op = 'DELETE' and old.role = 'admin' and old.status <> 'terminated')
     or (tg_op = 'UPDATE' and old.role = 'admin' and old.status <> 'terminated'
         and (new.role <> 'admin' or new.status = 'terminated')) then
    select count(*) into remaining from public.employees
      where organization_id = old.organization_id and role = 'admin'
        and status <> 'terminated' and id <> old.id;
    if remaining = 0 then
      raise exception 'An organization must keep at least one active admin' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger employees_last_admin before update or delete on public.employees
  for each row execute function private.protect_last_admin();

-- Every employee gets credential and compensation rows.
create or replace function private.employee_side_rows()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.employee_credentials (employee_id, organization_id)
    values (new.id, new.organization_id) on conflict do nothing;
  insert into public.employee_compensation (employee_id, organization_id)
    values (new.id, new.organization_id) on conflict do nothing;
  return new;
end $$;
create trigger employees_side_rows after insert on public.employees
  for each row execute function private.employee_side_rows();

-- ---------------------------------------------------------------------------
-- Kiosk devices: shared tablets bound to one organization
-- ---------------------------------------------------------------------------
create table public.kiosk_devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  token_hash text not null unique,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);
create index kiosk_devices_org_idx on public.kiosk_devices (organization_id);

create table public.kiosk_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code_hash text not null unique,
  device_name text not null check (length(device_name) between 1 and 80),
  created_by uuid references public.employees(id) on delete set null,
  expires_at timestamptz not null,
  used_at timestamptz,
  device_id uuid references public.kiosk_devices(id) on delete set null,
  created_at timestamptz not null default now()
);
create index kiosk_pairing_codes_org_idx on public.kiosk_pairing_codes (organization_id);

create table public.kiosk_attempts (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  device_id uuid not null references public.kiosk_devices(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  success boolean not null,
  reason text,
  created_at timestamptz not null default now()
);
create index kiosk_attempts_device_time_idx on public.kiosk_attempts (device_id, created_at desc);
create index kiosk_attempts_org_idx on public.kiosk_attempts (organization_id, created_at desc);
create index kiosk_attempts_employee_idx on public.kiosk_attempts (employee_id);

alter table public.kiosk_devices enable row level security;
alter table public.kiosk_pairing_codes enable row level security;
alter table public.kiosk_attempts enable row level security;

create policy kiosk_devices_select on public.kiosk_devices for select to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')));
create policy kiosk_devices_update on public.kiosk_devices for update to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')))
  with check (organization_id in (select private.org_ids_with_role('{admin}')));
create policy kiosk_devices_delete on public.kiosk_devices for delete to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')));
create policy kiosk_pairing_select on public.kiosk_pairing_codes for select to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')));
create policy kiosk_pairing_insert on public.kiosk_pairing_codes for insert to authenticated
  with check (organization_id in (select private.org_ids_with_role('{admin}')));
create policy kiosk_attempts_select on public.kiosk_attempts for select to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')));

-- ---------------------------------------------------------------------------
-- Audit log (append-only)
-- ---------------------------------------------------------------------------
create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_employee_id uuid references public.employees(id) on delete set null,
  actor_user_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_org_time_idx on public.audit_events (organization_id, created_at desc);
create index audit_events_entity_idx on public.audit_events (entity, entity_id);
create index audit_events_actor_idx on public.audit_events (actor_employee_id);
alter table public.audit_events enable row level security;
create policy audit_select on public.audit_events for select to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')));
create policy audit_insert on public.audit_events for insert to authenticated
  with check (organization_id in (select private.org_ids()) and actor_user_id = (select auth.uid()));
