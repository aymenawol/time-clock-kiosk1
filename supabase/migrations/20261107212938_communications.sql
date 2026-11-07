-- Chat (membership-based) and notifications (in-app bell plus optional email).

create table public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  kind text not null default 'group' check (kind in ('group', 'direct', 'role', 'emergency')),
  -- For kind = 'role': everyone holding one of these roles is a member.
  roles public.app_role[] not null default '{}',
  created_by uuid references public.employees(id) on delete set null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index chat_rooms_org_idx on public.chat_rooms (organization_id);
create index chat_rooms_created_by_idx on public.chat_rooms (created_by);

create table public.chat_members (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (room_id, employee_id)
);
create index chat_members_employee_idx on public.chat_members (employee_id);
create index chat_members_org_idx on public.chat_members (organization_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid references public.employees(id) on delete set null,
  body text not null check (length(body) between 1 and 4000),
  kind text not null default 'text' check (kind in ('text', 'alert')),
  requires_confirmation boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index chat_messages_room_time_idx on public.chat_messages (room_id, created_at desc);
create index chat_messages_org_idx on public.chat_messages (organization_id);
create index chat_messages_sender_idx on public.chat_messages (sender_id);

-- Receipt ladder: sent -> delivered -> read -> confirmed.
create table public.chat_receipts (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  confirmed_at timestamptz,
  reminders_sent smallint not null default 0,
  last_reminded_at timestamptz,
  primary key (message_id, employee_id)
);
create index chat_receipts_employee_idx on public.chat_receipts (employee_id);
create index chat_receipts_org_idx on public.chat_receipts (organization_id);

-- Rooms the caller belongs to (explicit member or by role).
create or replace function private.my_room_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select r.id from public.chat_rooms r
  join public.employees e on e.organization_id = r.organization_id
  where e.user_id = (select auth.uid()) and e.status <> 'terminated'
    and (
      exists (select 1 from public.chat_members m where m.room_id = r.id and m.employee_id = e.id)
      or (r.kind in ('role', 'emergency') and (cardinality(r.roles) = 0 or e.role = any(r.roles)))
    )
$$;
revoke all on function private.my_room_ids() from public;
grant execute on function private.my_room_ids() to authenticated, service_role;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  kind text not null check (length(kind) between 1 and 40),
  title text not null check (length(title) between 1 and 160),
  body text check (length(body) <= 2000),
  link text check (link is null or link ~ '^/[^/]'),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  read_at timestamptz,
  email_status text not null default 'none' check (email_status in ('none', 'pending', 'sending', 'sent', 'failed', 'skipped')),
  email_attempts smallint not null default 0,
  email_error text,
  created_at timestamptz not null default now()
);
create index notifications_employee_idx on public.notifications (employee_id, created_at desc);
create index notifications_unread_idx on public.notifications (employee_id) where read_at is null;
create index notifications_org_time_idx on public.notifications (organization_id, created_at desc);
create index notifications_email_pending_idx on public.notifications (created_at) where email_status = 'pending';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.chat_rooms enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_receipts enable row level security;
alter table public.notifications enable row level security;

create policy chat_rooms_select on public.chat_rooms for select to authenticated
  using (id in (select private.my_room_ids())
         or organization_id in (select private.org_ids_with_role('{admin}')));
create policy chat_rooms_admin on public.chat_rooms for all to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor}')))
  with check (organization_id in (select private.org_ids_with_role('{admin,supervisor}')));
create policy chat_members_select on public.chat_members for select to authenticated
  using (room_id in (select private.my_room_ids())
         or organization_id in (select private.org_ids_with_role('{admin}')));
create policy chat_members_admin on public.chat_members for all to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin,supervisor}')))
  with check (organization_id in (select private.org_ids_with_role('{admin,supervisor}')));
create policy chat_messages_select on public.chat_messages for select to authenticated
  using (room_id in (select private.my_room_ids()));
create policy chat_messages_insert on public.chat_messages for insert to authenticated
  with check (room_id in (select private.my_room_ids())
              and sender_id in (select private.my_employee_ids())
              and deleted_at is null
              and (kind = 'text' or organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}'))));
create policy chat_messages_moderate on public.chat_messages for update to authenticated
  using (sender_id in (select private.my_employee_ids())
         or organization_id in (select private.org_ids_with_role('{admin}')))
  with check (sender_id in (select private.my_employee_ids())
         or organization_id in (select private.org_ids_with_role('{admin}')));
create policy chat_receipts_select on public.chat_receipts for select to authenticated
  using (employee_id in (select private.my_employee_ids())
         or exists (select 1 from public.chat_messages m where m.id = message_id
                    and m.sender_id in (select private.my_employee_ids()))
         or organization_id in (select private.org_ids_with_role('{admin,supervisor,dispatcher}')));
create policy chat_receipts_own on public.chat_receipts for insert to authenticated
  with check (employee_id in (select private.my_employee_ids())
              and exists (select 1 from public.chat_messages m where m.id = message_id
                          and m.room_id in (select private.my_room_ids())));
create policy chat_receipts_own_update on public.chat_receipts for update to authenticated
  using (employee_id in (select private.my_employee_ids()))
  with check (employee_id in (select private.my_employee_ids()));

create policy notifications_select_own on public.notifications for select to authenticated
  using (employee_id in (select private.my_employee_ids()));
create policy notifications_admin_select on public.notifications for select to authenticated
  using (organization_id in (select private.org_ids_with_role('{admin}')));
-- Users may only mark their own notifications read (enforced by trigger below).
create policy notifications_mark_read on public.notifications for update to authenticated
  using (employee_id in (select private.my_employee_ids()))
  with check (employee_id in (select private.my_employee_ids()));

create or replace function private.guard_notification_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if;
  if (new.organization_id, new.employee_id, new.kind, new.title, new.body, new.link, new.severity,
      new.email_status, new.email_attempts, new.email_error, new.created_at)
     is distinct from
     (old.organization_id, old.employee_id, old.kind, old.title, old.body, old.link, old.severity,
      old.email_status, old.email_attempts, old.email_error, old.created_at) then
    raise exception 'Only read_at can be changed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger notifications_guard before update on public.notifications
  for each row execute function private.guard_notification_update();
