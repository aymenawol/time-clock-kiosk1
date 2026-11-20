-- The real paper forms are the source of truth (photos from the owner, 2026-11-19):
--   * "VEHICLE INSPECTION" (RAC DVIR 40FT Gillig): 40 items in three sections,
--     OK / X / NA marks, pre-trip and post-trip columns, PSI readings on the
--     brake checks, operator signature, next-driver review, technician sign-off.
--   * Counting sheet: grouped column headings (RAC > T-1 / T-3, TERM 1,
--     TERM 3 > West / East) and per-driver break slots.

-- ---------------------------------------------------------------------------
-- 1. Checklist layout
-- ---------------------------------------------------------------------------
alter table public.checklist_items
  -- Left or right column of its section on the paper form.
  add column paper_column smallint not null default 1 check (paper_column in (1, 2)),
  -- Starred items: checked on the post-trip ("Mini Pre-Trip") as well.
  add column mini boolean not null default false,
  -- Brake checks take a PSI reading.
  add column psi boolean not null default false,
  -- Optional heading inside a section, for example "AIR".
  add column subgroup text check (subgroup is null or length(subgroup) between 1 and 40),
  -- Shaded post-trip box on the paper: checked on the pre-trip only.
  add column pre_trip_only boolean not null default false,
  -- Small print under the label, for example "(Screens, Cables, Housing)".
  add column hint text check (hint is null or length(hint) between 1 and 80);

-- Replace every organization's checklist with the paper form. Old items stay
-- (inactive) so past inspections keep their references.
update public.checklist_items set active = false;

insert into public.checklist_items
  (organization_id, category, label, critical, sort, paper_column, mini, psi, subgroup, pre_trip_only, hint)
select o.id, v.category, v.label, v.critical, v.sort, v.paper_column, v.mini, v.psi, v.subgroup, v.pre_trip_only, v.hint
from public.organizations o
cross join (values
  ('Vehicle Exterior Checks', 'All lights & lenses',                  true,  1, 1, true,  false, null, false, null),
  ('Vehicle Exterior Checks', 'Turn signals & 4-way flashers',        true,  2, 1, true,  false, null, false, null),
  ('Vehicle Exterior Checks', 'Windshield wipers & washers',          false, 3, 1, false, false, null, false, null),
  ('Vehicle Exterior Checks', 'Door operation, seals intact/tight',   true,  4, 1, false, false, null, false, null),
  ('Vehicle Exterior Checks', 'Emergency door/windows',               true,  5, 1, false, false, null, false, null),
  ('Vehicle Exterior Checks', 'Tires, wheels & lugnuts',              true,  6, 2, true,  false, null, false, null),
  ('Vehicle Exterior Checks', 'Glass & mirrors',                      true,  7, 2, true,  false, null, false, null),
  ('Vehicle Exterior Checks', 'Body damage/lettering/decals',         false, 8, 2, false, false, null, false, null),
  ('Vehicle Exterior Checks', 'Under vehicle leaks',                  false, 9, 2, true,  false, null, false, null),
  ('Vehicle Exterior Checks', 'Passenger ramp operation',             false, 10, 2, false, false, null, false, null),
  ('Vehicle Interior Checks', 'Speedometer/instruments',              false, 11, 1, false, false, null, false, null),
  ('Vehicle Interior Checks', 'Heaters, defroster & ventilation',     false, 12, 1, false, false, null, false, null),
  ('Vehicle Interior Checks', 'Air conditioner',                      false, 13, 1, false, false, null, false, null),
  ('Vehicle Interior Checks', 'All gauges',                           false, 14, 1, true,  false, null, false, null),
  ('Vehicle Interior Checks', 'Horn/dashlights/hi/lo/indicator',      true,  15, 1, true,  false, null, false, null),
  ('Vehicle Interior Checks', 'Operator seat operation & belt',       false, 16, 1, false, false, null, false, null),
  ('Vehicle Interior Checks', 'Passenger seat securement',            false, 17, 1, false, false, null, false, null),
  ('Vehicle Interior Checks', 'Handrails',                            false, 18, 1, false, false, null, false, null),
  ('Vehicle Interior Checks', '2-way radio operation',                false, 19, 1, false, false, null, false, null),
  ('Vehicle Interior Checks', 'Steering operation',                   true,  20, 1, false, false, null, false, null),
  ('Vehicle Interior Checks', 'Front Monitor',                        false, 21, 1, true,  false, null, false, '(Screens, Cables, Housing)'),
  ('Vehicle Interior Checks', 'Fire Ext./Triangles/First aid kit',    false, 22, 2, false, false, null, false, null),
  ('Vehicle Interior Checks', 'Accident Packet',                      false, 23, 2, false, false, null, false, null),
  ('Vehicle Interior Checks', 'Vehicle Insurance & Reg.',             false, 24, 2, false, false, null, false, null),
  ('Vehicle Interior Checks', 'Wheelchair securement straps',         false, 25, 2, false, false, null, false, null),
  ('Vehicle Interior Checks', 'Exhaust noise',                        false, 26, 2, false, false, null, false, null),
  ('Vehicle Interior Checks', 'Parking brake',                        true,  27, 2, false, false, null, false, null),
  ('Vehicle Interior Checks', 'Interior clean',                       false, 28, 2, false, false, null, false, null),
  ('Vehicle Interior Checks', 'Interior lights',                      false, 29, 2, false, false, null, false, null),
  ('Vehicle Interior Checks', 'Destination sign',                     false, 30, 2, false, false, null, false, null),
  ('Vehicle Interior Checks', 'Backup alarm',                         false, 31, 2, false, false, null, false, null),
  ('Vehicle Interior Checks', 'Rear Monitor',                         false, 32, 2, true,  false, null, false, '(Screens, Cables, Housing)'),
  ('Brake System Checks',     'Cut In pressure',                      true,  33, 1, false, true,  'AIR', true, null),
  ('Brake System Checks',     'Cut out pressure',                     true,  34, 1, false, true,  'AIR', true, null),
  ('Brake System Checks',     'Static press, loss P/B on',            true,  35, 1, false, true,  'AIR', true, null),
  ('Brake System Checks',     'Static press, loss P/B off',           true,  36, 1, false, true,  'AIR', true, null),
  ('Brake System Checks',     'Applied pressure loss',                true,  37, 2, false, true,  null, true, null),
  ('Brake System Checks',     'Low pressure warning',                 true,  38, 2, true,  true,  null, true, null),
  ('Brake System Checks',     'Auto pop out (park brake)',            true,  39, 2, false, true,  null, true, null),
  ('Brake System Checks',     'Park brake hold',                      true,  40, 2, false, true,  null, true, null)
) as v(category, label, critical, sort, paper_column, mini, psi, subgroup, pre_trip_only, hint);

-- ---------------------------------------------------------------------------
-- 2. Inspection sign-offs
-- ---------------------------------------------------------------------------
-- Signatures are vector strokes normalised to 0..1, like the damage diagram:
--   [{ points: [[x, y], ...] }, ...]
alter table public.inspections
  add column operator_signature jsonb check (operator_signature is null or jsonb_typeof(operator_signature) = 'array'),
  -- "I indicate by my signature that I have reviewed the previous operator's vehicle inspection report."
  add column reviewed_inspection_id uuid references public.inspections(id) on delete set null,
  -- "NEXT DRIVER REVIEWED THIS DVI": set when the next driver acknowledges this report.
  add column next_reviewed_by uuid references public.employees(id) on delete set null,
  add column next_reviewed_at timestamptz,
  add column technician_comments text check (length(technician_comments) <= 2000),
  add column technician_signature jsonb check (technician_signature is null or jsonb_typeof(technician_signature) = 'array'),
  add column technician_signed_by uuid references public.employees(id) on delete set null,
  add column technician_signed_at timestamptz;
create index inspections_reviewed_idx on public.inspections (reviewed_inspection_id);
create index inspections_next_reviewed_by_idx on public.inspections (next_reviewed_by);
create index inspections_technician_idx on public.inspections (technician_signed_by);

-- Results entries are now
--   {item_id, category, label, critical, mark: 'ok' | 'x' | 'na' | null, psi: number | null, note}
-- Older entries used ok: true | false; both are accepted.
create or replace function public.submit_inspection(p_inspection_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  i public.inspections;
  prev public.inspections;
  item jsonb;
  mark text;
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
  if exists (
    select 1 from jsonb_array_elements(i.results) r
    where coalesce(r->>'mark', case r->>'ok' when 'true' then 'ok' when 'false' then 'x' end) is null
  ) then
    raise exception 'Mark every item OK, X or NA' using errcode = 'P0001';
  end if;
  if i.operator_signature is null or jsonb_array_length(i.operator_signature) = 0 then
    raise exception 'Sign the inspection before you submit it' using errcode = 'P0001';
  end if;

  for item in select * from jsonb_array_elements(i.results) loop
    mark := coalesce(item->>'mark', case item->>'ok' when 'true' then 'ok' when 'false' then 'x' end);
    if mark = 'x' then
      failed := failed + 1;
      if coalesce((item->>'critical')::boolean, false) then critical_failed := critical_failed + 1; end if;
      insert into public.defects (organization_id, vehicle_id, inspection_id, reported_by, category, item, description, severity)
      values (i.organization_id, i.vehicle_id, i.id, i.employee_id,
              left(coalesce(item->>'category', 'General'), 60), left(coalesce(item->>'label', 'Item'), 120),
              left(item->>'note', 2000),
              case when coalesce((item->>'critical')::boolean, false) then 'critical' else 'minor' end);
    end if;
  end loop;

  -- The previous operator's report this driver reviewed: mark it reviewed.
  if i.reviewed_inspection_id is not null then
    select * into prev from public.inspections where id = i.reviewed_inspection_id for update;
    if prev.id is null or prev.organization_id <> i.organization_id or prev.vehicle_id <> i.vehicle_id
       or prev.submitted_at is null or prev.id = i.id then
      raise exception 'That previous inspection is not for this vehicle' using errcode = 'P0001';
    end if;
    if prev.next_reviewed_by is null then
      update public.inspections set next_reviewed_by = i.employee_id, next_reviewed_at = now() where id = prev.id;
    end if;
  end if;

  update public.inspections set submitted_at = now(), defect_count = failed where id = i.id;
  select number into v_number from public.vehicles where id = i.vehicle_id;
  if critical_failed > 0 then
    perform set_config('rolecall.actor', i.employee_id::text, true);
    perform set_config('rolecall.reason', 'Failed critical inspection item', true);
    update public.vehicles set status = 'shop' where id = i.vehicle_id;
    perform private.notify_roles(i.organization_id, '{technician,dispatcher,supervisor}', 'vehicle_shop',
      'Vehicle ' || v_number || ' failed inspection',
      critical_failed || ' critical item(s) marked X. The vehicle is now in the shop.', '/fleet/defects', 'critical', true);
  elsif failed > 0 then
    perform private.notify_roles(i.organization_id, '{technician}', 'defect_reported',
      'Vehicle ' || v_number || ': ' || failed || ' defect(s) reported', null, '/m', 'warning', false);
  end if;
  return jsonb_build_object('defects', failed, 'critical', critical_failed);
end $$;

-- Technician's comments, signature and date on a submitted inspection.
create or replace function public.sign_inspection(p_inspection_id uuid, p_comments text, p_signature jsonb)
returns public.inspections language plpgsql security definer set search_path = '' as $$
declare
  i public.inspections;
  me public.employees;
begin
  select * into i from public.inspections where id = p_inspection_id for update;
  if i.id is null or not private.has_org_role(i.organization_id, '{admin,supervisor,technician}') then
    raise exception 'Inspection not found' using errcode = 'P0001';
  end if;
  if i.submitted_at is null then raise exception 'This inspection has not been submitted yet' using errcode = 'P0001'; end if;
  if i.technician_signed_at is not null then raise exception 'A technician already signed this inspection' using errcode = 'P0001'; end if;
  if p_signature is null or jsonb_typeof(p_signature) <> 'array' or jsonb_array_length(p_signature) = 0
     or jsonb_array_length(p_signature) > 60 then
    raise exception 'Add your signature' using errcode = 'P0001';
  end if;
  if length(coalesce(p_comments, '')) > 2000 then raise exception 'Keep comments under 2000 characters' using errcode = 'P0001'; end if;
  me := private.my_employee(i.organization_id);
  update public.inspections
     set technician_comments = nullif(trim(p_comments), ''), technician_signature = p_signature,
         technician_signed_by = me.id, technician_signed_at = now()
   where id = i.id returning * into i;
  return i;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Counting-sheet column headings
-- ---------------------------------------------------------------------------
alter table public.locations
  -- Heading over a group of columns, for example "RAC" over T-1 and T-3.
  add column count_group text check (count_group is null or length(count_group) between 1 and 30),
  -- The column's own heading, for example "T-1" or "West". Defaults to the name.
  add column count_label text check (count_label is null or length(count_label) between 1 and 30);

-- ---------------------------------------------------------------------------
-- 4. Break slots set by dispatch
-- ---------------------------------------------------------------------------
-- The paper sheet prints each driver's two 15-minute break slots
-- ("BRK Windows 06:15-06:30 / 09:45-10:00"). Dispatch assigns them; the plan
-- from lib/labor/breaks is the suggestion. Moving a slot keeps the window
-- length used by the break monitor.
create or replace function public.set_break_slot(p_break_id uuid, p_start timestamptz)
returns public.breaks language plpgsql security definer set search_path = '' as $$
declare
  b public.breaks;
  s public.shifts;
  len interval;
begin
  select * into b from public.breaks where id = p_break_id for update;
  if b.id is null or not private.has_org_role(b.organization_id, '{admin,supervisor,dispatcher}') then
    raise exception 'Break not found' using errcode = 'P0001';
  end if;
  if b.status <> 'planned' or b.started_at is not null then
    raise exception 'Only a break that has not started can be moved' using errcode = 'P0001';
  end if;
  select * into s from public.shifts where id = b.shift_id;
  if s.status <> 'active' then raise exception 'The shift is not active' using errcode = 'P0001'; end if;
  if p_start < s.clock_in_at or p_start > s.clock_in_at + interval '24 hours' then
    raise exception 'Pick a time during the shift' using errcode = 'P0001';
  end if;
  len := coalesce(b.window_end - b.window_start, make_interval(mins => b.planned_minutes));
  perform set_config('rolecall.internal', 'on', true);
  update public.breaks
     set window_start = p_start, window_end = p_start + len,
         reminder_sent_at = null, missed_alerted_at = null
   where id = b.id returning * into b;
  return b;
end $$;

revoke execute on function public.sign_inspection(uuid, text, jsonb), public.set_break_slot(uuid, timestamptz) from public, anon;
grant execute on function public.sign_inspection(uuid, text, jsonb), public.set_break_slot(uuid, timestamptz) to authenticated;
