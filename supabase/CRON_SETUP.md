# pg_cron scheduling for edge functions

The async layer (notifications, escalations, break compliance) is driven by
`pg_cron` jobs that `net.http_post` to each edge function. **Do not hardcode the
service-role key in a migration** — keep it in Supabase Vault and reference it,
so nothing secret is committed.

## One-time setup (per environment)

Extensions (already enabled in production):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

Store the service-role key in Vault once (run in the SQL editor, never commit the value):

```sql
select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
```

## Jobs

`<PROJECT_REF>` = your project ref (e.g. the subdomain of the project URL).
The existing 3 jobs (notification-processor, wheelchair-escalation, chat-reminder)
are already scheduled in production; **break-monitor is new** and must be added.
`cron.schedule` upserts by job name, so re-running is safe.

```sql
-- NEW: break compliance — missed / 17-min reminder / 20-min overrun
select cron.schedule(
  'break-monitor',
  '* * * * *',                       -- every minute
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/break-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret
                                      from vault.decrypted_secrets
                                      where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

For reference, the existing jobs follow the same shape:

| Job | Schedule | Function |
|-----|----------|----------|
| notification-processor | `* * * * *` (1 min) | `/functions/v1/notification-processor` |
| wheelchair-escalation | `* * * * *` (1 min) | `/functions/v1/wheelchair-escalation` |
| chat-reminder | `*/5 * * * *` (5 min) | `/functions/v1/chat-reminder` |
| **break-monitor** (new) | `* * * * *` (1 min) | `/functions/v1/break-monitor` |

## Verify

```sql
select jobname, schedule, active from cron.job order by jobname;
select * from cron.job_run_details order by start_time desc limit 20;
```

## Deploy the function first

```bash
npx supabase functions deploy break-monitor
```

(All four functions are registered in `supabase/config.toml` with `verify_jwt = true`,
so they are only callable with the service-role bearer used by the cron jobs.)
