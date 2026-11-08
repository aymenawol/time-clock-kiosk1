-- Employees can see the dates of locked pay periods they were paid in
-- (their own lines are already visible through pay_lines_own).
create or replace function private.my_locked_pay_period_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select distinct l.pay_period_id
  from public.pay_period_lines l
  join public.pay_periods p on p.id = l.pay_period_id and p.status = 'locked'
  where l.employee_id in (select private.my_employee_ids())
$$;
revoke all on function private.my_locked_pay_period_ids() from public, anon;
grant execute on function private.my_locked_pay_period_ids() to authenticated, service_role;

create policy pay_periods_select_own on public.pay_periods for select to authenticated
  using (id in (select private.my_locked_pay_period_ids()));
