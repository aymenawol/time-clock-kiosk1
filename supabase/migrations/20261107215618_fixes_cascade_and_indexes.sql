-- Follow-ups after the first push:
-- 1. Deleting an organization must cascade cleanly: RESTRICT foreign keys to
--    employees become NO ACTION (checked at end of statement), and the
--    last-admin guard steps aside when the organization itself is being deleted.
-- 2. Index the foreign keys the advisor flagged.
-- 3. SQL fallbacks for break lengths match lib/settings.ts (rest 15, meal 30).

alter table public.shifts drop constraint shifts_employee_id_fkey,
  add constraint shifts_employee_id_fkey foreign key (employee_id) references public.employees(id);
alter table public.pay_period_lines drop constraint pay_period_lines_employee_id_fkey,
  add constraint pay_period_lines_employee_id_fkey foreign key (employee_id) references public.employees(id);
alter table public.inspections drop constraint inspections_employee_id_fkey,
  add constraint inspections_employee_id_fkey foreign key (employee_id) references public.employees(id);
alter table public.inspections drop constraint inspections_vehicle_id_fkey,
  add constraint inspections_vehicle_id_fkey foreign key (vehicle_id) references public.vehicles(id);

create or replace function private.protect_last_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
declare remaining int;
begin
  -- The organization is being deleted (cascade): nothing to protect.
  if not exists (select 1 from public.organizations where id = old.organization_id) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
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

-- Locked-period guards must not block deleting a whole organization.
create or replace function private.guard_locked_period()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.organizations where id = old.organization_id) then
    return old;
  end if;
  if tg_op in ('UPDATE', 'DELETE') and private.in_locked_period(old.organization_id, old.work_date) then
    raise exception 'This time record is in a locked pay period' using errcode = 'P0001';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and private.in_locked_period(new.organization_id, new.work_date) then
    raise exception 'This time record is in a locked pay period' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create or replace function private.guard_break_locked()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d date; org uuid;
begin
  select s.work_date, s.organization_id into d, org from public.shifts s
    where s.id = coalesce(new.shift_id, old.shift_id);
  if d is not null and private.in_locked_period(org, d) then
    raise exception 'This break is in a locked pay period' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create index if not exists kiosk_devices_created_by_idx on public.kiosk_devices (created_by);
create index if not exists kiosk_pairing_codes_created_by_idx on public.kiosk_pairing_codes (created_by);
create index if not exists kiosk_pairing_codes_device_idx on public.kiosk_pairing_codes (device_id);

create or replace function private.do_start_break(p_employee uuid, p_kind public.break_kind)
returns public.breaks language plpgsql security definer set search_path = '' as $$
declare
  s public.shifts;
  b public.breaks;
  next_seq smallint;
begin
  select * into s from public.shifts where employee_id = p_employee and status = 'active' for update;
  if s.id is null then
    raise exception 'Not clocked in' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.breaks where employee_id = p_employee and started_at is not null and ended_at is null) then
    raise exception 'A break is already in progress' using errcode = 'P0001';
  end if;
  select * into b from public.breaks
    where shift_id = s.id and kind = p_kind and started_at is null and status in ('planned', 'missed')
    order by sequence limit 1 for update;
  if b.id is null then
    select coalesce(max(sequence), 0) + 1 into next_seq from public.breaks where shift_id = s.id and kind = p_kind;
    insert into public.breaks (organization_id, shift_id, employee_id, kind, paid, sequence, planned_minutes)
    values (s.organization_id, s.id, p_employee, p_kind, p_kind = 'rest', next_seq,
            case when p_kind = 'rest'
                 then private.setting_int(s.organization_id, '{breaks,restMinutes}', 15)
                 else private.setting_int(s.organization_id, '{breaks,mealMinutes}', 30) end)
    returning * into b;
  end if;
  update public.breaks set started_at = now(), status = 'active' where id = b.id returning * into b;
  return b;
end $$;
