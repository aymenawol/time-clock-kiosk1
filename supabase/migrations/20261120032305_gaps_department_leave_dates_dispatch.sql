-- Gaps from the v0 audit:
--   1. Employee department and shift (v0 employee form).
--   2. Leave dates on the ledger, so payroll can show PTO and FMLA hours per day.
--   3. Dispatchers may record a lunch waiver on a shift.
--   4. Overtime offers, bids and awards are published to Realtime.

-- 1. Department and shift -----------------------------------------------------
alter table public.employees
  add column department text check (department is null or length(department) between 1 and 60),
  add column shift text check (shift is null or length(shift) between 1 and 30);

-- 2. Leave dates --------------------------------------------------------------
-- The days the leave covers. Payroll spreads `hours` evenly across these days.
-- Opening balances and manual adjustments leave both null.
alter table public.leave_ledger
  add column taken_from date,
  add column taken_to date,
  add constraint leave_ledger_taken_range check (
    (taken_from is null and taken_to is null)
    or (taken_from is not null and taken_to is not null and taken_to >= taken_from and taken_to - taken_from <= 366)
  );
create index leave_ledger_taken_idx on public.leave_ledger (organization_id, taken_from) where taken_from is not null;

drop function public.review_form(uuid, text, text, text, numeric);
create function public.review_form(
  p_form_id uuid, p_decision text, p_comment text, p_leave_kind text default null, p_leave_hours numeric default null,
  p_taken_from date default null, p_taken_to date default null
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
    insert into public.leave_ledger (organization_id, employee_id, kind, hours, reason, form_id, created_by, taken_from, taken_to)
      values (f.organization_id, f.employee_id, p_leave_kind, -p_leave_hours, 'Approved request', f.id, me.id,
              p_taken_from, coalesce(p_taken_to, p_taken_from));
  end if;
  perform set_config('rolecall.reviewing', 'on', true);
  update public.form_submissions set status = p_decision, reviewer_id = me.id, reviewed_at = now(),
    reviewer_comment = nullif(trim(p_comment), '') where id = f.id returning * into f;
  perform private.notify(f.organization_id, array[f.employee_id], 'form_' || p_decision,
    'Your request was ' || p_decision, nullif(trim(p_comment), ''), '/m/forms', 'info', true);
  return f;
end $$;
revoke execute on function public.review_form(uuid, text, text, text, numeric, date, date) from public, anon;
grant execute on function public.review_form(uuid, text, text, text, numeric, date, date) to authenticated;

-- 3. Dispatchers may record a lunch waiver ------------------------------------
create or replace function private.guard_shift_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if;
  -- Set (transaction-local) by SECURITY DEFINER RPCs that already checked the caller.
  if current_setting('rolecall.internal', true) = 'on' then return new; end if;
  if private.has_org_role(old.organization_id, '{admin,supervisor}') then return new; end if;
  if (new.clock_in_at, new.clock_out_at, new.status, new.employee_id, new.work_date, new.organization_id)
     is distinct from
     (old.clock_in_at, old.clock_out_at, old.status, old.employee_id, old.work_date, old.organization_id) then
    raise exception 'Only an admin or supervisor can edit clock times' using errcode = '42501';
  end if;
  if not private.has_org_role(old.organization_id, '{dispatcher}') then
    -- Coordinators may only record compliance verdicts and notes.
    if (new.scheduled_start, new.scheduled_end, new.radio_status, new.meal_waived) is distinct from
       (old.scheduled_start, old.scheduled_end, old.radio_status, old.meal_waived) then
      raise exception 'Not allowed to change this shift' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- 4. Realtime for overtime ----------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['ot_offers', 'ot_bids', 'ot_awards']
  loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
