-- Storage buckets and policies, the Realtime publication, and pg_cron jobs.
-- Object paths are "<organization_id>/<entity_id>/<file>" so policies can scope
-- them by organization.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('defect-photos', 'defect-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('lost-found', 'lost-found', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "defect photos: org members read" on storage.objects for select to authenticated
  using (bucket_id = 'defect-photos'
         and (storage.foldername(name))[1] in (select o::text from private.org_ids() o));
create policy "defect photos: org members upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'defect-photos'
              and (storage.foldername(name))[1] in (select o::text from private.org_ids() o));
create policy "defect photos: admins delete" on storage.objects for delete to authenticated
  using (bucket_id = 'defect-photos'
         and (storage.foldername(name))[1] in (select o::text from private.org_ids_with_role('{admin}') o));

create policy "lost found: staff or uploader read" on storage.objects for select to authenticated
  using (bucket_id = 'lost-found'
         and ((storage.foldername(name))[1] in
                (select o::text from private.org_ids_with_role('{admin,supervisor,dispatcher,coordinator}') o)
              or (owner_id = (select auth.uid())::text
                  and (storage.foldername(name))[1] in (select o::text from private.org_ids() o))));
create policy "lost found: org members upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'lost-found'
              and (storage.foldername(name))[1] in (select o::text from private.org_ids() o));
create policy "lost found: admins delete" on storage.objects for delete to authenticated
  using (bucket_id = 'lost-found'
         and (storage.foldername(name))[1] in (select o::text from private.org_ids_with_role('{admin}') o));

-- ---------------------------------------------------------------------------
-- Realtime (RLS applies to postgres_changes subscribers)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['shifts', 'breaks', 'vehicles', 'vehicle_latest_positions', 'assist_requests',
    'emergencies', 'emergency_acks', 'announcements', 'chat_messages', 'chat_receipts', 'notifications',
    'fatigue_alerts', 'defects']
  loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Email dispatch: pg_cron calls the notification-dispatch edge function with a
-- shared secret. The URL and secret live in Vault (set by scripts/setup-remote.ts):
--   rolecall_functions_url  e.g. https://<ref>.supabase.co/functions/v1
--   rolecall_cron_secret    random string, also set as the function secret CRON_SECRET
-- ---------------------------------------------------------------------------
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create or replace function private.dispatch_email()
returns void language plpgsql security definer set search_path = '' as $$
declare
  base_url text;
  secret text;
begin
  if not exists (select 1 from public.notifications where email_status = 'pending') then
    return;
  end if;
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'rolecall_functions_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'rolecall_cron_secret';
  if base_url is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := base_url || '/notification-dispatch',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
    timeout_milliseconds := 20000
  );
end $$;
revoke execute on function private.dispatch_email() from public, anon, authenticated;

select cron.schedule('rolecall-break-monitor', '* * * * *', 'select private.run_break_monitor()');
select cron.schedule('rolecall-assist-escalation', '* * * * *', 'select private.run_assist_escalation()');
select cron.schedule('rolecall-chat-reminders', '*/5 * * * *', 'select private.run_chat_reminders()');
select cron.schedule('rolecall-email-dispatch', '* * * * *', 'select private.dispatch_email()');
select cron.schedule('rolecall-cleanup', '15 10 * * *', 'select private.run_cleanup()');
-- pg_cron keeps run history forever unless pruned.
select cron.schedule('rolecall-cron-history', '30 10 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);
