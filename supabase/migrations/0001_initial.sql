-- Initial migration for the Gantt App cloud backend.
--
-- Run via the Supabase CLI (`supabase db push`) or paste into the SQL editor
-- of your Supabase project once created. Phase 7 of the cloud migration plan
-- (see plans/i-want-to-share-smooth-hinton.md, Appendix A).

create extension if not exists pgcrypto;

-- ─── Tables ────────────────────────────────────────────────────────────

create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text,
  plan            text not null default 'free',
  workspace_quota int  not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table user_settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  tweaks     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table workspaces (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null default 'Workspace',
  version    int  not null default 6,
  data       jsonb not null,
  revision   int  not null default 0,
  edit_count int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workspaces_owner_idx on workspaces(owner_id);

create table workspace_snapshots (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  data         jsonb not null,
  version      int  not null,
  edit_count   int  not null,
  reason       text not null default 'auto',     -- 'auto' | 'manual' | 'pre-restore'
  created_at   timestamptz not null default now()
);
create index workspace_snapshots_ws_idx
  on workspace_snapshots(workspace_id, created_at desc);

create table shares (
  token            text primary key,             -- 22-char nanoid, URL-safe
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  mode             text not null check (mode in ('open','password')),
  password_hash    text,                         -- bcrypt; null when mode='open'
  created_at       timestamptz not null default now(),
  revoked_at       timestamptz,
  last_accessed_at timestamptz
);
create index shares_workspace_idx on shares(workspace_id);

-- ─── RLS ───────────────────────────────────────────────────────────────

alter table profiles            enable row level security;
alter table user_settings       enable row level security;
alter table workspaces          enable row level security;
alter table workspace_snapshots enable row level security;
alter table shares              enable row level security;

create policy profiles_self_rw on profiles
  using (id = auth.uid()) with check (id = auth.uid());

create policy settings_self_rw on user_settings
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy workspaces_owner_rw on workspaces
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy snapshots_owner_rw on workspace_snapshots
  using (exists (select 1 from workspaces w
                 where w.id = workspace_snapshots.workspace_id
                   and w.owner_id = auth.uid()))
  with check (exists (select 1 from workspaces w
                      where w.id = workspace_snapshots.workspace_id
                        and w.owner_id = auth.uid()));

create policy shares_owner_rw on shares
  using (exists (select 1 from workspaces w
                 where w.id = shares.workspace_id
                   and w.owner_id = auth.uid()))
  with check (exists (select 1 from workspaces w
                      where w.id = shares.workspace_id
                        and w.owner_id = auth.uid()));

-- (No anon select policy on workspaces — anon reads go via resolve_share RPC.)

-- ─── Functions & triggers ──────────────────────────────────────────────

create or replace function handle_new_user()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email) values (new.id, new.email);
  insert into user_settings (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function enforce_workspace_quota()
  returns trigger language plpgsql as $$
declare q int; c int;
begin
  select workspace_quota into q from profiles where id = new.owner_id;
  select count(*)        into c from workspaces where owner_id = new.owner_id;
  if c >= q then
    raise exception 'workspace_quota_exceeded' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger workspaces_quota
  before insert on workspaces
  for each row execute function enforce_workspace_quota();

create or replace function snapshot_on_workspace_update()
  returns trigger language plpgsql as $$
begin
  if new.data is distinct from old.data then
    new.edit_count := old.edit_count + 1;
    new.revision   := old.revision + 1;
    new.updated_at := now();
    insert into workspace_snapshots (workspace_id, data, version, edit_count, reason)
      values (new.id, new.data, new.version, new.edit_count, 'auto');
    delete from workspace_snapshots
      where workspace_id = new.id
        and id not in (
          select id from workspace_snapshots
          where workspace_id = new.id
          order by created_at desc
          limit 20
        );
  end if;
  return new;
end $$;

create trigger workspaces_snapshot
  before update on workspaces
  for each row execute function snapshot_on_workspace_update();

create or replace function resolve_share(p_token text, p_password text default null)
  returns table (workspace_id uuid, name text, version int, data jsonb, revision int)
  language plpgsql security definer set search_path = public as $$
declare s shares%rowtype;
begin
  select * into s from shares where token = p_token and revoked_at is null;
  if not found then raise exception 'share_not_found' using errcode = 'P0002'; end if;
  if s.mode = 'password' then
    if p_password is null
       or s.password_hash is null
       or s.password_hash <> crypt(p_password, s.password_hash)
    then raise exception 'share_password_invalid' using errcode = 'P0003'; end if;
  end if;
  update shares set last_accessed_at = now() where token = p_token;
  return query
    select w.id, w.name, w.version, w.data, w.revision
    from workspaces w where w.id = s.workspace_id;
end $$;
grant execute on function resolve_share(text, text) to anon, authenticated;

create or replace function create_snapshot(p_workspace uuid, p_reason text default 'manual')
  returns uuid language plpgsql security invoker as $$
declare new_id uuid;
begin
  insert into workspace_snapshots (workspace_id, data, version, edit_count, reason)
    select id, data, version, edit_count, p_reason from workspaces
    where id = p_workspace and owner_id = auth.uid()
  returning id into new_id;
  return new_id;
end $$;

create or replace function restore_snapshot(p_snapshot uuid)
  returns void language plpgsql security invoker as $$
declare s workspace_snapshots%rowtype;
begin
  select ws.* into s
  from workspace_snapshots ws
  where ws.id = p_snapshot
    and exists (select 1 from workspaces w
                 where w.id = ws.workspace_id
                   and w.owner_id = auth.uid());
  if not found then raise exception 'snapshot_not_found'; end if;
  perform create_snapshot(s.workspace_id, 'pre-restore');
  update workspaces set data = s.data, version = s.version where id = s.workspace_id;
end $$;
