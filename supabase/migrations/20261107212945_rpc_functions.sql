-- Functions: notification fan-out, field actions (radio codes, breaks, GPS,
-- inspections, end of shift, counts, safety sign-in, bids), atomic office
-- actions (OT awards, bid awards, form review, pay-period lock), kiosk RPCs
-- (service role only) and the monitors run by pg_cron.
--
-- Every SECURITY DEFINER function sets search_path = '' and checks the caller.
-- EXECUTE is revoked from public/anon and granted only where intended.

-- ---------------------------------------------------------------------------
-- Settings helpers (defaults mirror lib/settings.ts)
-- ---------------------------------------------------------------------------
create or replace function private.setting_int(org uuid, path text[], fallback int)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce((select (o.settings #>> path)::int from public.organizations o where o.id = org), fallback)
$$;

create or replace function private.setting_bool(org uuid, path text[], fallback boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select (o.settings #>> path)::boolean from public.organizations o where o.id = org), fallback)
$$;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create or replace function private.notify(
  org uuid, recipients uuid[], p_kind text, p_title text, p_body text,
  p_link text default null, p_severity text default 'info', p_email boolean default false
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer;
  email_on boolean := p_email and private.setting_bool(org, '{notifications,email}', false);
begin
  insert into public.notifications (organization_id, employee_id, kind, title, body, link, severity, email_status)
  select org, e.id, p_kind, left(p_title, 160), left(p_body, 2000), p_link, p_severity,
         case when email_on and e.email is not null then 'pending' else 'none' end
  from public.employees e
  where e.organization_id = org and e.id = any(recipients) and e.status <> 'terminated';
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function private.notify_roles(
  org uuid, p_roles public.app_role[], p_kind text, p_title text, p_body text,
  p_link text default null, p_severity text default 'info', p_email boolean default false
) returns integer language sql security definer set search_path = '' as $$
  select private.notify(org,
    array(select e.id from public.employees e
          where e.organization_id = org and e.status = 'active' and e.role = any(p_roles)),
    p_kind, p_title, p_body, p_link, p_severity, p_email)
$$;

create or replace function private.employee_name(emp uuid)
returns text language sql stable security definer set search_path = '' as $$
  select e.first_name || ' ' || e.last_name from public.employees e where e.id = emp
$$;

-- The caller's active shift (field roles are on at most one at a time).
create or replace function private.my_active_shift()
returns public.shifts language sql stable security definer set search_path = '' as $$
  select s.* from public.shifts s
  where s.status = 'active' and s.employee_id in (select private.my_employee_ids())
  order by s.clock_in_at desc limit 1
$$;

-- ---------------------------------------------------------------------------
-- Radio codes
-- ---------------------------------------------------------------------------
create or replace function public.set_radio_status(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.shifts;
  rc public.radio_codes;
  v_number text;
begin
  s := private.my_active_shift();
  if s.id is null then
    raise exception 'You are not clocked in' using errcode = 'P0001';
  end if;
  select * into rc from public.radio_codes
    where organization_id = s.organization_id and code = p_code and active and driver_selectable;
  if rc.id is null then
    raise exception 'Unknown radio code' using errcode = 'P0001';
  end if;
  perform set_config('rolecall.internal', 'on', true);
  update public.shifts set radio_status = rc.code, radio_status_at = now() where id = s.id;
  if rc.sets_vehicle_status is not null and s.vehicle_id is not null then
    perform set_config('rolecall.actor', s.employee_id::text, true);
    perform set_config('rolecall.reason', 'Radio ' || rc.code, true);
    update public.vehicles set status = rc.sets_vehicle_status where id = s.vehicle_id
      returning number into v_number;
  end if;
  if cardinality(rc.notify_roles) > 0 then
    perform private.notify_roles(s.organization_id, rc.notify_roles, 'radio_code',
      rc.code || ' ' || rc.label || ': ' || private.employee_name(s.employee_id),
      coalesce('Vehicle ' || v_number, null), '/board',
      case when rc.is_alert then 'critical' else 'info' end, rc.is_alert);
  end if;
  return jsonb_build_object('code', rc.code, 'label', rc.label, 'vehicle_status', rc.sets_vehicle_status);
end $$;

-- ---------------------------------------------------------------------------
-- Breaks (shared by the phone and the kiosk)
-- ---------------------------------------------------------------------------
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
                 then private.setting_int(s.organization_id, '{breaks,restMinutes}', 10)
                 else private.setting_int(s.organization_id, '{breaks,mealMinutes}', 30) end)
    returning * into b;
  end if;
  update public.breaks set started_at = now(), status = 'active' where id = b.id returning * into b;
  return b;
end $$;

create or replace function private.do_end_break(p_employee uuid)
returns public.breaks language plpgsql security definer set search_path = '' as $$
declare
  b public.breaks;
begin
  select * into b from public.breaks
    where employee_id = p_employee and started_at is not null and ended_at is null for update;
  if b.id is null then
    raise exception 'No break in progress' using errcode = 'P0001';
  end if;
  update public.breaks
    set ended_at = now(), status = case when status = 'overrun' then 'overrun'::public.break_status else 'completed' end
    where id = b.id returning * into b;
  return b;
end $$;

create or replace function public.start_break(p_kind public.break_kind)
returns public.breaks language plpgsql security definer set search_path = '' as $$
declare s public.shifts;
begin
  s := private.my_active_shift();
  if s.id is null then raise exception 'You are not clocked in' using errcode = 'P0001'; end if;
  return private.do_start_break(s.employee_id, p_kind);
end $$;

create or replace function public.end_break()
returns public.breaks language plpgsql security definer set search_path = '' as $$
declare s public.shifts;
begin
  s := private.my_active_shift();
  if s.id is null then raise exception 'You are not clocked in' using errcode = 'P0001'; end if;
  return private.do_end_break(s.employee_id);
end $$;

-- Dispatcher re-opens a missed or overrun break with a fresh window.
create or replace function public.reopen_break(p_break_id uuid)
returns public.breaks language plpgsql security definer set search_path = '' as $$
declare
  b public.breaks;
  flex int;
begin
  select * into b from public.breaks where id = p_break_id for update;
  if b.id is null or not private.has_org_role(b.organization_id, '{admin,supervisor,dispatcher}') then
    raise exception 'Break not found' using errcode = 'P0001';
  end if;
  if b.status not in ('missed') or b.started_at is not null then
    raise exception 'Only a missed break that was never started can be re-opened' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.shifts s where s.id = b.shift_id and s.status = 'active') then
    raise exception 'The shift has ended' using errcode = 'P0001';
  end if;
  flex := private.setting_int(b.organization_id, '{breaks,reopenWindowMinutes}', 45);
  update public.breaks set status = 'planned', window_start = now(), window_end = now() + make_interval(mins => flex),
    missed_alerted_at = null, reopened_by = (private.my_employee(b.organization_id)).id, reopened_at = now()
    where id = b.id returning * into b;
  perform private.notify(b.organization_id, array[b.employee_id], 'break_reopened',
    'Your break has been re-opened', 'Take it within the next ' || flex || ' minutes.', '/m', 'info', false);
  return b;
end $$;

-- Breaks follow their shift's locked-period rule.
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
create trigger breaks_locked_period before insert or update or delete on public.breaks
  for each row execute function private.guard_break_locked();

-- ---------------------------------------------------------------------------
-- GPS
-- ---------------------------------------------------------------------------
create or replace function public.record_position(
  p_lat double precision, p_lng double precision, p_speed_mps real default null,
  p_heading real default null, p_accuracy_m real default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  s public.shifts;
  last_at timestamptz;
begin
  s := private.my_active_shift();
  if s.id is null or s.vehicle_id is null then return false; end if;
  if p_accuracy_m is not null and p_accuracy_m > 500 then return false; end if;
  select recorded_at into last_at from public.vehicle_latest_positions where vehicle_id = s.vehicle_id;
  if last_at is not null and last_at > now() - interval '5 seconds' then return false; end if;
  insert into public.vehicle_positions
    (organization_id, vehicle_id, employee_id, shift_id, lat, lng, speed_mps, heading, accuracy_m)
  values (s.organization_id, s.vehicle_id, s.employee_id, s.id, p_lat, p_lng,
          greatest(p_speed_mps, 0), case when p_heading between 0 and 360 then p_heading end, p_accuracy_m);
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Inspections
-- ---------------------------------------------------------------------------
create or replace function public.submit_inspection(p_inspection_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  i public.inspections;
  item jsonb;
  failed int := 0;
  critical_failed int := 0;
  v_number text;
begin
  select * into i from public.inspections where id = p_inspection_id for update;
  if i.id is null or i.employee_id not in (select private.my_employee_ids()) then
    raise exception 'Inspection not found' using errcode = 'P0001';
  end if;
  if i.submitted_at is not null then
    raise exception 'This inspection was already submitted' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(i.results) r where r->'ok' is null or r->'ok' = 'null'::jsonb) then
    raise exception 'Every checklist item needs a pass or fail' using errcode = 'P0001';
  end if;
  for item in select * from jsonb_array_elements(i.results) loop
    if (item->>'ok')::boolean is false then
      failed := failed + 1;
      if coalesce((item->>'critical')::boolean, false) then critical_failed := critical_failed + 1; end if;
      insert into public.defects (organization_id, vehicle_id, inspection_id, reported_by, category, item, description, severity)
      values (i.organization_id, i.vehicle_id, i.id, i.employee_id,
              left(coalesce(item->>'category', 'General'), 60), left(coalesce(item->>'label', 'Item'), 120),
              left(item->>'note', 2000),
              case when coalesce((item->>'critical')::boolean, false) then 'critical' else 'minor' end);
    end if;
  end loop;
  update public.inspections set submitted_at = now(), defect_count = failed where id = i.id;
  select number into v_number from public.vehicles where id = i.vehicle_id;
  if critical_failed > 0 then
    perform set_config('rolecall.actor', i.employee_id::text, true);
    perform set_config('rolecall.reason', 'Failed critical inspection item', true);
    update public.vehicles set status = 'shop' where id = i.vehicle_id;
    perform private.notify_roles(i.organization_id, '{technician,dispatcher,supervisor}', 'vehicle_shop',
      'Vehicle ' || v_number || ' failed inspection',
      critical_failed || ' critical item(s) failed. The vehicle is now in the shop.', '/fleet/defects', 'critical', true);
  elsif failed > 0 then
    perform private.notify_roles(i.organization_id, '{technician}', 'defect_reported',
      'Vehicle ' || v_number || ': ' || failed || ' defect(s) reported', null, '/m', 'warning', false);
  end if;
  return jsonb_build_object('defects', failed, 'critical', critical_failed);
end $$;

-- Manual defect reports notify technicians.
create or replace function private.on_defect_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.inspection_id is null then
    perform private.notify_roles(new.organization_id, '{technician}', 'defect_reported',
      'New defect: ' || new.item, new.description, '/m', case when new.severity = 'critical' then 'critical' else 'warning' end, false);
  end if;
  return new;
end $$;
create trigger defects_notify after insert on public.defects
  for each row execute function private.on_defect_insert();

-- ---------------------------------------------------------------------------
-- End of shift vehicle report
-- ---------------------------------------------------------------------------
create or replace function public.submit_end_of_shift(
  p_energy_level smallint, p_condition text, p_odometer integer, p_notes text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.shifts;
  new_status public.vehicle_status;
  v_number text;
begin
  s := private.my_active_shift();
  if s.id is null then raise exception 'You are not clocked in' using errcode = 'P0001'; end if;
  if p_condition not in ('ready', 'needs_charge', 'needs_fuel', 'shop', 'hazard') then
    raise exception 'Invalid vehicle condition' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.end_of_shift_reports where shift_id = s.id) then
    raise exception 'End of shift was already submitted' using errcode = 'P0001';
  end if;
  insert into public.end_of_shift_reports (organization_id, shift_id, employee_id, vehicle_id, energy_level, condition, odometer, notes)
    values (s.organization_id, s.id, s.employee_id, s.vehicle_id, p_energy_level, p_condition, p_odometer, left(p_notes, 2000));
  if s.vehicle_id is not null then
    new_status := case p_condition
      when 'ready' then 'ready' when 'needs_charge' then 'charging' when 'needs_fuel' then 'needs_fuel'
      when 'shop' then 'shop' else 'safety_hold' end;
    perform set_config('rolecall.actor', s.employee_id::text, true);
    perform set_config('rolecall.reason', 'End of shift report', true);
    update public.vehicles set status = new_status,
      energy_level = coalesce(p_energy_level, energy_level),
      odometer = greatest(coalesce(p_odometer, odometer), coalesce(odometer, 0))
      where id = s.vehicle_id returning number into v_number;
    if p_condition in ('hazard', 'shop') then
      perform private.notify_roles(s.organization_id, '{dispatcher,supervisor,technician}', 'vehicle_' || p_condition,
        'Vehicle ' || v_number || case when p_condition = 'hazard' then ' reported as a hazard' else ' needs the shop' end,
        left(p_notes, 500), '/fleet', case when p_condition = 'hazard' then 'critical' else 'warning' end, p_condition = 'hazard');
    end if;
  end if;
  perform set_config('rolecall.internal', 'on', true);
  update public.shifts set radio_status = null, radio_status_at = now() where id = s.id;
  return jsonb_build_object('vehicle_status', new_status);
end $$;

-- ---------------------------------------------------------------------------
-- Counting sheets
-- ---------------------------------------------------------------------------
create or replace function public.submit_count_sheet(p_sheet_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.count_sheets;
begin
  select * into c from public.count_sheets where id = p_sheet_id for update;
  if c.id is null or c.employee_id not in (select private.my_employee_ids()) then
    raise exception 'Counting sheet not found' using errcode = 'P0001';
  end if;
  if c.status <> 'draft' then raise exception 'Already submitted' using errcode = 'P0001'; end if;
  update public.count_sheets set status = 'submitted', submitted_at = now() where id = c.id;
  perform private.notify_roles(c.organization_id, '{dispatcher}', 'count_sheet_submitted',
    'Counting sheet submitted by ' || private.employee_name(c.employee_id), null, '/counts', 'info', false);
end $$;

-- ---------------------------------------------------------------------------
-- Safety meeting self sign-in
-- ---------------------------------------------------------------------------
create or replace function public.safety_sign_in(p_meeting_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  m public.safety_meetings;
  me public.employees;
  st text;
begin
  select * into m from public.safety_meetings where id = p_meeting_id;
  if m.id is null then raise exception 'Meeting not found' using errcode = 'P0001'; end if;
  me := private.my_employee(m.organization_id);
  if me.id is null then raise exception 'Meeting not found' using errcode = 'P0001'; end if;
  if m.status <> 'scheduled' then raise exception 'This meeting is not open for sign-in' using errcode = 'P0001'; end if;
  if cardinality(m.audience) > 0 and not (me.role = any(m.audience)) then
    raise exception 'This meeting is not for your role' using errcode = 'P0001';
  end if;
  if now() < m.starts_at - interval '30 minutes'
     or now() > m.starts_at + make_interval(mins => m.duration_minutes) then
    raise exception 'Sign-in opens 30 minutes before the meeting and closes when it ends' using errcode = 'P0001';
  end if;
  st := case when now() <= m.starts_at + interval '5 minutes' then 'present' else 'late' end;
  insert into public.safety_attendance (meeting_id, employee_id, organization_id, status, signed_in_at)
    values (m.id, me.id, m.organization_id, st, now())
    on conflict (meeting_id, employee_id) do nothing;
  return st;
end $$;

-- ---------------------------------------------------------------------------
-- Shift bids
-- ---------------------------------------------------------------------------
create or replace function public.submit_bid_preferences(p_cycle_id uuid, p_line_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.bid_cycles;
  me public.employees;
begin
  select * into c from public.bid_cycles where id = p_cycle_id;
  if c.id is null then raise exception 'Bid cycle not found' using errcode = 'P0001'; end if;
  me := private.my_employee(c.organization_id);
  if me.id is null then raise exception 'Bid cycle not found' using errcode = 'P0001'; end if;
  if c.status <> 'open' or now() < c.opens_at or now() > c.closes_at then
    raise exception 'Bidding is closed for this cycle' using errcode = 'P0001';
  end if;
  if cardinality(p_line_ids) < 1 or cardinality(p_line_ids) > c.max_choices then
    raise exception 'Choose between 1 and % lines', c.max_choices using errcode = 'P0001';
  end if;
  if (select count(distinct x) from unnest(p_line_ids) x) <> cardinality(p_line_ids) then
    raise exception 'Each line can be chosen once' using errcode = 'P0001';
  end if;
  if (select count(*) from public.bid_lines l where l.cycle_id = c.id and l.id = any(p_line_ids)) <> cardinality(p_line_ids) then
    raise exception 'A chosen line is not in this cycle' using errcode = 'P0001';
  end if;
  insert into public.bid_preferences (organization_id, cycle_id, employee_id, line_ids, submitted_at)
    values (c.organization_id, c.id, me.id, p_line_ids, now())
    on conflict (cycle_id, employee_id) do update set line_ids = excluded.line_ids, submitted_at = now();
end $$;

-- Awards computed by lib/scheduling/bids.ts, applied atomically here.
-- p_awards: [{employee_id, line_id, choice_rank, method, reason}]
create or replace function public.apply_bid_awards(p_cycle_id uuid, p_awards jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  c public.bid_cycles;
  me public.employees;
  n integer;
begin
  select * into c from public.bid_cycles where id = p_cycle_id for update;
  if c.id is null or not private.has_org_role(c.organization_id, '{admin}') then
    raise exception 'Bid cycle not found' using errcode = 'P0001';
  end if;
  if c.status not in ('closed', 'awarded') then
    raise exception 'Close bidding before awarding' using errcode = 'P0001';
  end if;
  me := private.my_employee(c.organization_id);
  delete from public.bid_awards where cycle_id = c.id;
  insert into public.bid_awards (organization_id, cycle_id, line_id, employee_id, choice_rank, method, reason, awarded_by)
  select c.organization_id, c.id, (a->>'line_id')::uuid, (a->>'employee_id')::uuid,
         nullif(a->>'choice_rank', '')::smallint, a->>'method', a->>'reason', me.id
  from jsonb_array_elements(p_awards) a;
  get diagnostics n = row_count;
  if exists (select 1 from public.bid_awards a join public.bid_lines l on l.id = a.line_id
             where a.cycle_id = c.id and l.cycle_id <> c.id) then
    raise exception 'An award references a line from another cycle' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.bid_awards a join public.employees e on e.id = a.employee_id
             where a.cycle_id = c.id and e.organization_id <> c.organization_id) then
    raise exception 'An award references an employee from another organization' using errcode = 'P0001';
  end if;
  if exists (select a.line_id from public.bid_awards a join public.bid_lines l on l.id = a.line_id
             where a.cycle_id = c.id group by a.line_id, l.capacity having count(*) > l.capacity) then
    raise exception 'A line has more awards than its capacity' using errcode = 'P0001';
  end if;
  update public.bid_cycles set status = 'awarded', awarded_at = now(), awarded_by = me.id where id = c.id;
  perform private.notify(c.organization_id, array(select employee_id from public.bid_awards where cycle_id = c.id),
    'bid_awarded', 'Shift bid results are in', c.name, '/m/bids', 'info', true);
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Overtime awards (locks the offer so a double click cannot double-award)
-- ---------------------------------------------------------------------------
create or replace function public.award_ot_offer(p_offer_id uuid, p_employee_ids uuid[], p_method text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  o public.ot_offers;
  me public.employees;
  n integer;
begin
  select * into o from public.ot_offers where id = p_offer_id for update;
  if o.id is null or not private.has_org_role(o.organization_id, '{admin,supervisor,dispatcher}') then
    raise exception 'Overtime offer not found' using errcode = 'P0001';
  end if;
  if o.status not in ('open', 'closed') then
    raise exception 'This offer was already awarded or cancelled' using errcode = 'P0001';
  end if;
  if p_method not in ('seniority', 'manual') then raise exception 'Invalid method' using errcode = 'P0001'; end if;
  if cardinality(p_employee_ids) < 1 or cardinality(p_employee_ids) > o.slots then
    raise exception 'Award between 1 and % employees', o.slots using errcode = 'P0001';
  end if;
  if (select count(*) from public.employees e where e.id = any(p_employee_ids)
        and e.organization_id = o.organization_id and e.status = 'active') <> cardinality(p_employee_ids) then
    raise exception 'Every awardee must be an active employee' using errcode = 'P0001';
  end if;
  if p_method = 'seniority' and (select count(*) from public.ot_bids b where b.offer_id = o.id
        and b.employee_id = any(p_employee_ids)) <> cardinality(p_employee_ids) then
    raise exception 'Seniority awards must go to bidders' using errcode = 'P0001';
  end if;
  me := private.my_employee(o.organization_id);
  insert into public.ot_awards (organization_id, offer_id, employee_id, method, awarded_by)
    select o.organization_id, o.id, x, p_method, me.id from unnest(p_employee_ids) x;
  get diagnostics n = row_count;
  update public.ot_offers set status = 'awarded' where id = o.id;
  perform private.notify(o.organization_id, p_employee_ids, 'overtime_awarded', 'You were awarded overtime',
    to_char(o.starts_at at time zone (select timezone from public.organizations where id = o.organization_id), 'Dy Mon DD HH24:MI')
      || ' for ' || round(o.duration_minutes / 60.0, 1) || ' h', '/m/overtime', 'info', true);
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Form review with side effects (leave deduction, resignation)
-- ---------------------------------------------------------------------------
create or replace function public.review_form(
  p_form_id uuid, p_decision text, p_comment text, p_leave_kind text default null, p_leave_hours numeric default null
) returns public.form_submissions language plpgsql security definer set search_path = '' as $$
declare
  f public.form_submissions;
  me public.employees;
begin
  select * into f from public.form_submissions where id = p_form_id for update;
  if f.id is null or not private.has_org_role(f.organization_id, '{admin,supervisor}') then
    raise exception 'Request not found' using errcode = 'P0001';
  end if;
  me := private.my_employee(f.organization_id);
  if f.employee_id = me.id then raise exception 'You cannot review your own request' using errcode = 'P0001'; end if;
  if f.status <> 'submitted' then raise exception 'This request was already decided' using errcode = 'P0001'; end if;
  if p_decision not in ('approved', 'denied', 'returned') then raise exception 'Invalid decision' using errcode = 'P0001'; end if;
  if p_decision in ('denied', 'returned') and coalesce(length(trim(p_comment)), 0) = 0 then
    raise exception 'Add a comment when denying or returning a request' using errcode = 'P0001';
  end if;
  if p_decision = 'approved' and f.form_type = 'resignation' then
    if not private.has_org_role(f.organization_id, '{admin}') then
      raise exception 'Only an admin can approve a resignation' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.shifts where employee_id = f.employee_id and status = 'active') then
      raise exception 'The employee is still clocked in' using errcode = 'P0001';
    end if;
    update public.employees set status = 'terminated' where id = f.employee_id;
  end if;
  if p_decision = 'approved' and p_leave_kind is not null and p_leave_hours is not null and p_leave_hours > 0 then
    insert into public.leave_ledger (organization_id, employee_id, kind, hours, reason, form_id, created_by)
      values (f.organization_id, f.employee_id, p_leave_kind, -p_leave_hours, 'Approved request', f.id, me.id);
  end if;
  perform set_config('rolecall.reviewing', 'on', true);
  update public.form_submissions set status = p_decision, reviewer_id = me.id, reviewed_at = now(),
    reviewer_comment = nullif(trim(p_comment), '') where id = f.id returning * into f;
  perform private.notify(f.organization_id, array[f.employee_id], 'form_' || p_decision,
    'Your request was ' || p_decision, nullif(trim(p_comment), ''), '/m/forms', 'info', true);
  return f;
end $$;

create or replace function private.on_form_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_roles(new.organization_id, '{admin,supervisor}', 'form_submitted',
    'New request from ' || private.employee_name(new.employee_id), replace(new.form_type, '_', ' '),
    '/forms/' || new.id, 'info', false);
  return new;
end $$;
create trigger form_submissions_notify after insert on public.form_submissions
  for each row execute function private.on_form_insert();

-- ---------------------------------------------------------------------------
-- Pay periods: lines computed by lib/labor, stored atomically at lock.
-- ---------------------------------------------------------------------------
create or replace function public.lock_pay_period(p_period_id uuid, p_lines jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  p public.pay_periods;
  me public.employees;
  n integer;
begin
  select * into p from public.pay_periods where id = p_period_id for update;
  if p.id is null or not private.has_org_role(p.organization_id, '{admin}') then
    raise exception 'Pay period not found' using errcode = 'P0001';
  end if;
  if p.status <> 'open' then raise exception 'Pay period is already locked' using errcode = 'P0001'; end if;
  if exists (select 1 from public.shifts s where s.organization_id = p.organization_id and s.status = 'active'
             and s.work_date between p.starts_on and p.ends_on) then
    raise exception 'Some employees are still clocked in for this period' using errcode = 'P0001';
  end if;
  me := private.my_employee(p.organization_id);
  delete from public.pay_period_lines where pay_period_id = p.id;
  insert into public.pay_period_lines (organization_id, pay_period_id, employee_id, regular_minutes, daily_ot_minutes,
    weekly_ot_minutes, paid_break_minutes, unpaid_break_minutes, leave_minutes, pay_rate_cents, regular_cents,
    overtime_cents, gross_cents, detail)
  select p.organization_id, p.id, (l->>'employee_id')::uuid, (l->>'regular_minutes')::int, (l->>'daily_ot_minutes')::int,
    (l->>'weekly_ot_minutes')::int, (l->>'paid_break_minutes')::int, (l->>'unpaid_break_minutes')::int,
    coalesce((l->>'leave_minutes')::int, 0), (l->>'pay_rate_cents')::int, (l->>'regular_cents')::bigint,
    (l->>'overtime_cents')::bigint, (l->>'gross_cents')::bigint, coalesce(l->'detail', '{}'::jsonb)
  from jsonb_array_elements(p_lines) l;
  get diagnostics n = row_count;
  if exists (select 1 from public.pay_period_lines pl join public.employees e on e.id = pl.employee_id
             where pl.pay_period_id = p.id and e.organization_id <> p.organization_id) then
    raise exception 'A line references an employee from another organization' using errcode = 'P0001';
  end if;
  update public.pay_periods set status = 'locked', locked_at = now(), locked_by = me.id where id = p.id;
  return n;
end $$;

create or replace function public.unlock_pay_period(p_period_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.pay_periods;
begin
  select * into p from public.pay_periods where id = p_period_id for update;
  if p.id is null or not private.has_org_role(p.organization_id, '{admin}') then
    raise exception 'Pay period not found' using errcode = 'P0001';
  end if;
  update public.pay_periods set status = 'open', locked_at = null, locked_by = null where id = p.id;
  delete from public.pay_period_lines where pay_period_id = p.id;
end $$;

-- ---------------------------------------------------------------------------
-- Notification triggers for operational events
-- ---------------------------------------------------------------------------
create or replace function private.on_assist_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_roles(new.organization_id, '{dispatcher,supervisor}', 'assist_request',
    'Assist request: ' || new.passenger_name,
    coalesce((select name from public.airlines where id = new.airline_id), 'Airline not set')
      || coalesce(' flight ' || new.flight_number, '') || ' from ' || private.employee_name(new.employee_id),
    '/assists', 'warning', false);
  return new;
end $$;
create trigger assist_requests_notify after insert on public.assist_requests
  for each row execute function private.on_assist_insert();

create or replace function private.on_assist_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status in ('acknowledged', 'resolved') then
    perform private.notify(new.organization_id, array[new.employee_id], 'assist_' || new.status,
      'Dispatch ' || new.status || ' your assist request', new.response, '/m', 'info', false);
  end if;
  return new;
end $$;
create trigger assist_requests_notify_update after update on public.assist_requests
  for each row execute function private.on_assist_update();

create or replace function private.on_emergency_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify(new.organization_id,
    array(select id from public.employees where organization_id = new.organization_id and status = 'active'),
    'emergency', new.title, new.message, '/emergency', 'critical', true);
  return new;
end $$;
create trigger emergencies_notify after insert on public.emergencies
  for each row execute function private.on_emergency_insert();

create or replace function private.on_fatigue_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_roles(new.organization_id, '{dispatcher,supervisor}', 'fatigue_alert',
    'Fatigue: ' || private.employee_name(new.employee_id), new.message, '/fatigue', new.severity, new.severity = 'critical');
  perform private.notify(new.organization_id, array[new.employee_id], 'fatigue_alert',
    'Fatigue check', new.message, '/m', new.severity, false);
  return new;
end $$;
create trigger fatigue_alerts_notify after insert on public.fatigue_alerts
  for each row execute function private.on_fatigue_insert();

create or replace function private.on_lost_item_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_roles(new.organization_id, '{dispatcher}', 'lost_item',
    'Lost item reported: ' || new.description, 'Reference ' || new.reference, '/lost-found', 'info', false);
  return new;
end $$;
create trigger lost_items_notify after insert on public.lost_items
  for each row execute function private.on_lost_item_insert();

create or replace function private.on_chat_message_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r public.chat_rooms;
begin
  if new.requires_confirmation or new.kind = 'alert' then
    select * into r from public.chat_rooms where id = new.room_id;
    perform private.notify(new.organization_id,
      array(select e.id from public.employees e
            where e.organization_id = new.organization_id and e.status = 'active' and e.id is distinct from new.sender_id
              and (exists (select 1 from public.chat_members m where m.room_id = r.id and m.employee_id = e.id)
                   or (r.kind in ('role', 'emergency') and (cardinality(r.roles) = 0 or e.role = any(r.roles))))),
      'chat_confirmation', 'Please confirm: ' || r.name, left(new.body, 300), '/chat?room=' || r.id,
      case when new.kind = 'alert' then 'critical' else 'warning' end, new.kind = 'alert');
  end if;
  return new;
end $$;
create trigger chat_messages_notify after insert on public.chat_messages
  for each row execute function private.on_chat_message_insert();

-- ---------------------------------------------------------------------------
-- Admin: set an employee PIN (bcrypt). The app validates PIN strength.
-- ---------------------------------------------------------------------------
create or replace function public.set_employee_pin(p_employee_id uuid, p_pin text)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.employees;
begin
  select * into e from public.employees where id = p_employee_id;
  if e.id is null then raise exception 'Employee not found' using errcode = 'P0001'; end if;
  if (select auth.uid()) is not null and not private.has_org_role(e.organization_id, '{admin}') then
    raise exception 'Employee not found' using errcode = 'P0001';
  end if;
  if p_pin !~ '^[0-9]{4,8}$' then raise exception 'PIN must be 4 to 8 digits' using errcode = 'P0001'; end if;
  update public.employee_credentials
    set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 10)), pin_set_at = now(),
        failed_count = 0, locked_until = null, updated_at = now()
    where employee_id = e.id;
end $$;

-- ---------------------------------------------------------------------------
-- Kiosk RPCs: service role only (the server holds the device cookie).
-- ---------------------------------------------------------------------------
create or replace function public.kiosk_pair(p_code_hash text, p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.kiosk_pairing_codes;
  d public.kiosk_devices;
begin
  select * into c from public.kiosk_pairing_codes where code_hash = p_code_hash for update;
  if c.id is null or c.used_at is not null or c.expires_at < now() then
    return jsonb_build_object('ok', false);
  end if;
  insert into public.kiosk_devices (organization_id, name, token_hash, created_by)
    values (c.organization_id, c.device_name, p_token_hash, c.created_by) returning * into d;
  update public.kiosk_pairing_codes set used_at = now(), device_id = d.id where id = c.id;
  return jsonb_build_object('ok', true, 'device_id', d.id, 'organization_id', d.organization_id, 'name', d.name);
end $$;

create or replace function public.kiosk_device(p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d public.kiosk_devices;
  o public.organizations;
begin
  select * into d from public.kiosk_devices where token_hash = p_token_hash and revoked_at is null;
  if d.id is null then return null; end if;
  update public.kiosk_devices set last_seen_at = now()
    where id = d.id and (last_seen_at is null or last_seen_at < now() - interval '1 minute');
  select * into o from public.organizations where id = d.organization_id;
  return jsonb_build_object('device_id', d.id, 'device_name', d.name, 'organization_id', o.id,
    'organization_name', o.name, 'timezone', o.timezone, 'settings', o.settings);
end $$;

-- Verifies employee number + PIN with per-employee lockout (5 failures -> 15 min)
-- and per-device throttling (20 failures in 10 min -> device cooldown).
create or replace function public.kiosk_verify_pin(p_device_id uuid, p_employee_number text, p_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d public.kiosk_devices;
  e public.employees;
  c public.employee_credentials;
  device_failures int;
  max_failures int;
  lock_minutes int;
begin
  select * into d from public.kiosk_devices where id = p_device_id and revoked_at is null;
  if d.id is null then return jsonb_build_object('result', 'device_revoked'); end if;
  select count(*) into device_failures from public.kiosk_attempts
    where device_id = d.id and not success and created_at > now() - interval '10 minutes';
  if device_failures >= 20 then
    return jsonb_build_object('result', 'device_locked');
  end if;
  max_failures := private.setting_int(d.organization_id, '{kiosk,maxPinAttempts}', 5);
  lock_minutes := private.setting_int(d.organization_id, '{kiosk,lockoutMinutes}', 15);
  select * into e from public.employees
    where organization_id = d.organization_id and employee_number = p_employee_number and status <> 'terminated';
  if e.id is null then
    insert into public.kiosk_attempts (organization_id, device_id, success, reason) values (d.organization_id, d.id, false, 'unknown_employee');
    return jsonb_build_object('result', 'invalid');
  end if;
  select * into c from public.employee_credentials where employee_id = e.id for update;
  if c.locked_until is not null and c.locked_until > now() then
    insert into public.kiosk_attempts (organization_id, device_id, employee_id, success, reason) values (d.organization_id, d.id, e.id, false, 'locked');
    return jsonb_build_object('result', 'locked', 'locked_until', c.locked_until);
  end if;
  if c.pin_hash is null or extensions.crypt(p_pin, c.pin_hash) <> c.pin_hash then
    update public.employee_credentials
      set failed_count = failed_count + 1,
          locked_until = case when failed_count + 1 >= max_failures then now() + make_interval(mins => lock_minutes) end,
          updated_at = now()
      where employee_id = e.id returning * into c;
    insert into public.kiosk_attempts (organization_id, device_id, employee_id, success, reason)
      values (d.organization_id, d.id, e.id, false, case when c.pin_hash is null then 'no_pin' else 'bad_pin' end);
    if c.locked_until is not null then
      perform private.notify_roles(d.organization_id, '{admin}', 'kiosk_lockout',
        'PIN locked: ' || e.first_name || ' ' || e.last_name, 'Too many wrong PIN attempts on ' || d.name, '/people/' || e.id, 'warning', false);
      return jsonb_build_object('result', 'locked', 'locked_until', c.locked_until);
    end if;
    return jsonb_build_object('result', 'invalid');
  end if;
  update public.employee_credentials set failed_count = 0, locked_until = null, updated_at = now() where employee_id = e.id;
  insert into public.kiosk_attempts (organization_id, device_id, employee_id, success) values (d.organization_id, d.id, e.id, true);
  return jsonb_build_object('result', 'ok', 'employee_id', e.id);
end $$;

-- p_breaks: [{kind, paid, sequence, planned_minutes, window_start, window_end}]
create or replace function public.kiosk_clock_in(p_device_id uuid, p_employee_id uuid, p_work_date date, p_breaks jsonb)
returns public.shifts language plpgsql security definer set search_path = '' as $$
declare
  d public.kiosk_devices;
  e public.employees;
  s public.shifts;
begin
  select * into d from public.kiosk_devices where id = p_device_id and revoked_at is null;
  select * into e from public.employees where id = p_employee_id;
  if d.id is null or e.id is null or e.organization_id <> d.organization_id or e.status <> 'active' then
    raise exception 'Not allowed' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.shifts where employee_id = e.id and status = 'active') then
    raise exception 'Already clocked in' using errcode = 'P0001';
  end if;
  insert into public.shifts (organization_id, employee_id, work_date, clock_in_at, source_in, kiosk_in_device_id)
    values (e.organization_id, e.id, p_work_date, now(), 'kiosk', d.id) returning * into s;
  insert into public.breaks (organization_id, shift_id, employee_id, kind, paid, sequence, planned_minutes, window_start, window_end)
  select s.organization_id, s.id, e.id, (b->>'kind')::public.break_kind, (b->>'paid')::boolean,
         (b->>'sequence')::smallint, (b->>'planned_minutes')::smallint,
         (b->>'window_start')::timestamptz, (b->>'window_end')::timestamptz
  from jsonb_array_elements(coalesce(p_breaks, '[]'::jsonb)) b;
  return s;
end $$;

create or replace function public.kiosk_clock_out(p_device_id uuid, p_employee_id uuid)
returns public.shifts language plpgsql security definer set search_path = '' as $$
declare
  d public.kiosk_devices;
  s public.shifts;
begin
  select * into d from public.kiosk_devices where id = p_device_id and revoked_at is null;
  select * into s from public.shifts where employee_id = p_employee_id and status = 'active' for update;
  if d.id is null or s.id is null or s.organization_id <> d.organization_id then
    raise exception 'Not clocked in' using errcode = 'P0001';
  end if;
  update public.breaks set ended_at = now(),
    status = case when status = 'overrun' then 'overrun'::public.break_status else 'completed' end
    where shift_id = s.id and started_at is not null and ended_at is null;
  update public.breaks set status = case when window_start is not null and window_start >= now()
                                         then 'waived'::public.break_status else 'missed' end
    where shift_id = s.id and started_at is null and status = 'planned';
  update public.shifts set clock_out_at = now(), status = 'completed', source_out = 'kiosk',
    kiosk_out_device_id = d.id where id = s.id returning * into s;
  return s;
end $$;

create or replace function public.kiosk_start_break(p_device_id uuid, p_employee_id uuid, p_kind public.break_kind)
returns public.breaks language plpgsql security definer set search_path = '' as $$
declare d public.kiosk_devices;
begin
  select * into d from public.kiosk_devices where id = p_device_id and revoked_at is null;
  if d.id is null or not exists (select 1 from public.employees where id = p_employee_id and organization_id = d.organization_id) then
    raise exception 'Not allowed' using errcode = 'P0001';
  end if;
  return private.do_start_break(p_employee_id, p_kind);
end $$;

create or replace function public.kiosk_end_break(p_device_id uuid, p_employee_id uuid)
returns public.breaks language plpgsql security definer set search_path = '' as $$
declare d public.kiosk_devices;
begin
  select * into d from public.kiosk_devices where id = p_device_id and revoked_at is null;
  if d.id is null or not exists (select 1 from public.employees where id = p_employee_id and organization_id = d.organization_id) then
    raise exception 'Not allowed' using errcode = 'P0001';
  end if;
  return private.do_end_break(p_employee_id);
end $$;

-- ---------------------------------------------------------------------------
-- Monitors (pg_cron)
-- ---------------------------------------------------------------------------
create or replace function private.run_break_monitor()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  b record;
  missed int := 0;
  reminded int := 0;
  overrun int := 0;
begin
  -- Planned breaks whose window closed while the shift is still active.
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

  -- Running breaks past their length plus the reminder grace.
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
    perform private.notify_roles(b.organization_id, '{dispatcher,supervisor}', 'break_overrun',
      'Break overrun: ' || private.employee_name(b.employee_id),
      b.kind || ' break started ' || to_char(b.started_at at time zone 'UTC', 'HH24:MI') || ' UTC', '/compliance', 'warning', false);
  end loop;

  return jsonb_build_object('missed', missed, 'reminded', reminded, 'overrun', overrun);
end $$;

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
      'No response from dispatch yet', 'Call dispatch directly about ' || r.passenger_name || '.', '/m', 'critical', false);
    perform private.notify_roles(r.organization_id, '{admin,supervisor,dispatcher}', 'assist_escalated',
      'Assist request unanswered: ' || r.passenger_name,
      'No dispatcher response within ' || private.setting_int(r.organization_id, '{assist,escalationMinutes}', 5) || ' minutes.',
      '/assists', 'critical', true);
  end loop;
  return n;
end $$;

create or replace function private.run_chat_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  m record;
  n int := 0;
begin
  for m in
    select msg.id as message_id, msg.organization_id, r.name as room_name, r.id as room_id, e.id as employee_id
    from public.chat_messages msg
    join public.chat_rooms r on r.id = msg.room_id
    join public.employees e on e.organization_id = msg.organization_id and e.status = 'active'
      and e.id is distinct from msg.sender_id
      and (exists (select 1 from public.chat_members cm where cm.room_id = r.id and cm.employee_id = e.id)
           or (r.kind in ('role', 'emergency') and (cardinality(r.roles) = 0 or e.role = any(r.roles))))
    left join public.chat_receipts rc on rc.message_id = msg.id and rc.employee_id = e.id
    where msg.requires_confirmation and msg.deleted_at is null
      and msg.created_at between now() - interval '24 hours' and now() - interval '30 minutes'
      and (rc.confirmed_at is null)
      and coalesce(rc.reminders_sent, 0) < 3
      and (rc.last_reminded_at is null or rc.last_reminded_at < now() - interval '55 minutes')
  loop
    insert into public.chat_receipts (message_id, employee_id, organization_id, reminders_sent, last_reminded_at)
      values (m.message_id, m.employee_id, m.organization_id, 1, now())
      on conflict (message_id, employee_id) do update
        set reminders_sent = public.chat_receipts.reminders_sent + 1, last_reminded_at = now();
    perform private.notify(m.organization_id, array[m.employee_id], 'chat_confirmation',
      'Reminder: confirm a message in ' || m.room_name, null, '/chat?room=' || m.room_id, 'warning', false);
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function private.run_cleanup()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.vehicle_positions p
    where p.recorded_at < now() - make_interval(days => private.setting_int(p.organization_id, '{gps,retentionDays}', 30));
  delete from public.kiosk_attempts where created_at < now() - interval '90 days';
  delete from public.kiosk_pairing_codes where expires_at < now() - interval '1 day';
  delete from public.notifications where read_at is not null and read_at < now() - interval '90 days';
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon;

grant execute on function
  public.set_radio_status(text), public.start_break(public.break_kind), public.end_break(),
  public.reopen_break(uuid), public.record_position(double precision, double precision, real, real, real),
  public.submit_inspection(uuid), public.submit_end_of_shift(smallint, text, integer, text),
  public.submit_count_sheet(uuid), public.safety_sign_in(uuid),
  public.submit_bid_preferences(uuid, uuid[]), public.apply_bid_awards(uuid, jsonb),
  public.award_ot_offer(uuid, uuid[], text), public.review_form(uuid, text, text, text, numeric),
  public.lock_pay_period(uuid, jsonb), public.unlock_pay_period(uuid), public.set_employee_pin(uuid, text)
  to authenticated;

revoke execute on function public.kiosk_pair(text, text), public.kiosk_device(text),
  public.kiosk_verify_pin(uuid, text, text), public.kiosk_clock_in(uuid, uuid, date, jsonb),
  public.kiosk_clock_out(uuid, uuid), public.kiosk_start_break(uuid, uuid, public.break_kind),
  public.kiosk_end_break(uuid, uuid) from authenticated;
grant execute on all functions in schema public to service_role;
grant execute on all functions in schema private to service_role;

-- Functions created later in public must not be callable by anon by default.
alter default privileges in schema public revoke execute on functions from public, anon;
