-- Restore the v0 escalation chains (owner: v0 behaviour is the spec; v0's
-- "management" role maps to admin) and add a status RPC that records the reason.
--   v0 wheelchair-escalation: driver + admin/management after 5 minutes.
--   v0 break-monitor: missed -> dispatcher/coordinator/supervisor;
--                     overrun -> dispatcher/management/supervisor.
--   v0 fatigue trigger: dispatcher/supervisor/management.

create or replace function private.run_assist_escalation()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
begin
  for r in
    update public.assist_requests a set status = 'escalated', escalated_at = now()
    where a.status = 'pending' and a.responded_at is null
      and a.created_at < now() - make_interval(mins => private.setting_int(a.organization_id, '{assist,escalationMinutes}', 5))
    returning a.*
  loop
    n := n + 1;
    perform private.notify(r.organization_id, array[r.employee_id], 'assist_escalated',
      'No dispatcher response - please call dispatch directly', 'Assist request for ' || r.passenger_name || '.', '/m', 'critical', false);
    perform private.notify_roles(r.organization_id, '{admin,supervisor}', 'assist_escalated',
      '10-51 escalated: no dispatcher response in '
        || private.setting_int(r.organization_id, '{assist,escalationMinutes}', 5) || ' minutes',
      r.passenger_name || coalesce(' · flight ' || r.flight_number, ''), '/assists', 'critical', true);
  end loop;
  return n;
end $$;

create or replace function private.on_fatigue_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_roles(new.organization_id, '{dispatcher,supervisor,admin}', 'fatigue_alert',
    'Fatigue: ' || private.employee_name(new.employee_id), new.message, '/fatigue', new.severity, new.severity = 'critical');
  perform private.notify(new.organization_id, array[new.employee_id], 'fatigue_alert',
    'Fatigue check', new.message, '/m', new.severity, false);
  return new;
end $$;

-- Overrun alerts also go to admins (v0 "management").
create or replace function private.run_break_monitor()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  b record;
  missed int := 0;
  reminded int := 0;
  overrun int := 0;
begin
  for b in
    update public.breaks br set status = 'missed', missed_alerted_at = now()
    from public.shifts s
    where s.id = br.shift_id and s.status = 'active' and br.status = 'planned'
      and br.started_at is null and br.window_end is not null and br.window_end < now()
    returning br.*
  loop
    missed := missed + 1;
    perform private.notify(b.organization_id, array[b.employee_id], 'break_missed',
      'You missed your ' || b.kind || ' break', 'Ask dispatch to re-open it.', '/m', 'warning', false);
    perform private.notify_roles(b.organization_id, '{dispatcher,coordinator,supervisor}', 'break_missed',
      'Missed ' || b.kind || ' break: ' || private.employee_name(b.employee_id), null, '/compliance', 'warning', false);
  end loop;

  for b in
    update public.breaks br set reminder_sent_at = now()
    where br.started_at is not null and br.ended_at is null and br.reminder_sent_at is null
      and now() >= br.started_at + make_interval(mins => br.planned_minutes
            + private.setting_int(br.organization_id, '{breaks,reminderGraceMinutes}', 2))
    returning br.*
  loop
    reminded := reminded + 1;
    perform private.notify(b.organization_id, array[b.employee_id], 'break_reminder',
      'Your break time is up', 'Please end your break.', '/m', 'warning', false);
  end loop;

  for b in
    update public.breaks br set status = 'overrun', overrun_alerted_at = now()
    where br.started_at is not null and br.ended_at is null and br.overrun_alerted_at is null
      and now() >= br.started_at + make_interval(mins => br.planned_minutes
            + private.setting_int(br.organization_id, '{breaks,overrunGraceMinutes}', 5))
    returning br.*
  loop
    overrun := overrun + 1;
    perform private.notify_roles(b.organization_id, '{dispatcher,supervisor,admin}', 'break_overrun',
      'Break overrun: ' || private.employee_name(b.employee_id), b.kind || ' break is past its time.', '/compliance', 'warning', false);
  end loop;

  return jsonb_build_object('missed', missed, 'reminded', reminded, 'overrun', overrun);
end $$;

-- Office status changes with a recorded reason and actor (fleet pages).
create or replace function public.set_vehicle_status(p_vehicle_id uuid, p_status public.vehicle_status, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.vehicles;
  me public.employees;
begin
  select * into v from public.vehicles where id = p_vehicle_id for update;
  if v.id is null or not private.has_org_role(v.organization_id, '{admin,supervisor,dispatcher,technician,fueler}') then
    raise exception 'Vehicle not found' using errcode = 'P0001';
  end if;
  if coalesce(length(trim(p_reason)), 0) < 3 then
    raise exception 'Give a reason for the status change' using errcode = 'P0001';
  end if;
  me := private.my_employee(v.organization_id);
  perform set_config('rolecall.actor', me.id::text, true);
  perform set_config('rolecall.reason', left(trim(p_reason), 500), true);
  update public.vehicles set status = p_status where id = v.id;
end $$;
revoke execute on function public.set_vehicle_status(uuid, public.vehicle_status, text) from public, anon;
grant execute on function public.set_vehicle_status(uuid, public.vehicle_status, text) to authenticated, service_role;
