-- 1. A driver may read the submitted inspections of the vehicle they are on
--    right now, so they can review the previous operator's report (paper:
--    "I indicate by my signature that I have reviewed the previous operator's
--    vehicle inspection report"). Nothing else about other drivers opens up.
create or replace function private.my_active_vehicle_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select s.vehicle_id from public.shifts s
  where s.status = 'active' and s.vehicle_id is not null
    and s.employee_id in (select private.my_employee_ids())
$$;
revoke execute on function private.my_active_vehicle_ids() from public, anon;
grant execute on function private.my_active_vehicle_ids() to authenticated;

create policy inspections_select_current_vehicle on public.inspections for select to authenticated
  using (submitted_at is not null and vehicle_id in (select private.my_active_vehicle_ids()));

-- 2. The 10-8 time on the paper inspection: when the driver first went in
--    service on this shift. shifts.radio_status only holds the latest code.
alter table public.shifts add column in_service_at timestamptz;

create or replace function private.stamp_in_service()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.radio_status = '10-8' and new.in_service_at is null
     and (tg_op = 'INSERT' or old.radio_status is distinct from new.radio_status) then
    new.in_service_at := coalesce(new.radio_status_at, now());
  end if;
  return new;
end $$;
create trigger shifts_stamp_in_service before insert or update of radio_status on public.shifts
  for each row execute function private.stamp_in_service();

-- Backfill shifts currently in service.
update public.shifts set in_service_at = coalesce(radio_status_at, clock_in_at)
where radio_status = '10-8' and in_service_at is null;
