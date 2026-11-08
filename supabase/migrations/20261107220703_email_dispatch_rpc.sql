-- Email delivery for notifications (used by the notification-dispatch edge
-- function, service role only). Rows are claimed with SKIP LOCKED so two runs
-- never send the same email, and rows stuck in 'sending' are retried.

create or replace function public.claim_email_notifications(p_limit integer default 50)
returns table (
  id uuid,
  email text,
  first_name text,
  organization_name text,
  title text,
  body text,
  link text,
  severity text,
  attempts smallint
) language plpgsql security definer set search_path = '' as $$
begin
  update public.notifications set email_status = 'pending'
    where email_status = 'sending' and created_at < now() - interval '10 minutes' and email_attempts < 3;

  return query
  with claimed as (
    select n.id from public.notifications n
    where n.email_status = 'pending'
    order by n.created_at
    limit greatest(1, least(p_limit, 200))
    for update skip locked
  ), updated as (
    update public.notifications n set email_status = 'sending', email_attempts = n.email_attempts + 1
    from claimed c where n.id = c.id
    returning n.*
  )
  select u.id, e.email, e.first_name, o.name, u.title, u.body, u.link, u.severity, u.email_attempts
  from updated u
  join public.employees e on e.id = u.employee_id
  join public.organizations o on o.id = u.organization_id;
end $$;

create or replace function public.complete_email_notification(p_id uuid, p_status text, p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('sent', 'failed', 'skipped', 'pending') then
    raise exception 'Invalid status' using errcode = 'P0001';
  end if;
  update public.notifications
    set email_status = case when p_status = 'failed' and email_attempts < 3 then 'pending' else p_status end,
        email_error = left(p_error, 500)
    where id = p_id;
end $$;

revoke execute on function public.claim_email_notifications(integer), public.complete_email_notification(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_email_notifications(integer), public.complete_email_notification(uuid, text, text)
  to service_role;
