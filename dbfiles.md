# 001
-- ============================================================
-- TABLES
-- ============================================================

-- Anonymous + authenticated users
create table if not exists trader_users (
  id            uuid primary key default gen_random_uuid(),
  anonymous_id  text unique not null,
  auth_user_id  uuid references auth.users(id),
  org_id        uuid,                          -- filled after joining an org
  org_role      text check (org_role in ('admin', 'member')),
  user_type     text check (user_type in ('indie', 'org_member', 'org_admin')),
  role          text default 'user',           -- legacy field, keep for compat
  created_at    timestamptz default now()
);

create index if not exists idx_trader_users_auth_user_id on trader_users(auth_user_id);

-- Organisations
create table if not exists organisations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  domain     text,
  created_at timestamptz default now()
);

-- Add FK after both tables exist
alter table trader_users
  add constraint trader_users_org_id_fkey
  foreign key (org_id) references organisations(id);

-- Invite codes
create table if not exists org_invites (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid references organisations(id) on delete cascade,
  code       text unique not null,
  role       text default 'member' check (role in ('member', 'admin')),
  created_by uuid references trader_users(id),
  expires_at timestamptz not null,
  max_uses   int default null,
  use_count  int default 0,
  created_at timestamptz default now()
);

-- Trades
create table if not exists trades (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references trader_users(id) on delete cascade,
  ticker        text not null,
  entry_price   numeric not null,
  entry_target  numeric,
  stop_loss     numeric not null,
  target        numeric,
  quantity      integer not null,
  risk_amount   numeric,
  capital       numeric default 100000,
  exit_price    numeric,
  realised_pnl  numeric,
  notes         text,
  status        text default 'OPEN'
    check (status in ('QUEUED','OPEN','CLOSED','STOPPED','TARGET_HIT')),
  created_at    timestamptz default now()
);

-- ============================================================
-- GRANTS (table-level permissions for anon + authenticated)
-- ============================================================

grant select, insert, update, delete on public.trader_users   to anon, authenticated;
grant select, insert, update, delete on public.organisations  to authenticated;
grant select, insert, update, delete on public.org_invites    to authenticated;
grant select, insert, update, delete on public.trades         to anon, authenticated;

-- ============================================================
-- ROW LEVEL SECURITY — trader_users
-- ============================================================

alter table trader_users enable row level security;

-- Anon: full access (for anonymous trade saving + migration)
create policy "trader_users_anon"
  on trader_users for all to anon
  using (true) with check (true);

-- Authenticated: select/update/delete own row
create policy "trader_users_select"
  on trader_users for select to authenticated
  using (auth_user_id = auth.uid());

create policy "trader_users_update"
  on trader_users for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy "trader_users_delete"
  on trader_users for delete to authenticated
  using (auth_user_id = auth.uid());

-- Authenticated: insert own row
create policy "trader_users_insert"
  on trader_users for insert to authenticated
  with check (true);

-- ============================================================
-- ROW LEVEL SECURITY — trades
-- ============================================================

alter table trades enable row level security;

-- Anon: full access (for anonymous trade saving)
create policy "anon_all_trades"
  on trades for all to anon
  using (true) with check (true);

-- Authenticated: own trades always visible
-- Org admins can also see all trades in their org
create policy "authenticated_own_trades"
  on trades for select to authenticated
  using (
    -- own trades
    user_id in (
      select id from trader_users where auth_user_id = auth.uid()
    )
    or
    -- org admin sees all member trades
    user_id in (
      select tu.id from trader_users tu
      where tu.org_id = (
        select org_id from trader_users
        where auth_user_id = auth.uid() and org_role = 'admin'
      )
      and tu.org_id is not null
    )
  );

create policy "authenticated_insert_trades"
  on trades for insert to authenticated
  with check (
    user_id in (
      select id from trader_users where auth_user_id = auth.uid()
    )
  );

create policy "authenticated_update_trades"
  on trades for update to authenticated
  using (
    user_id in (
      select id from trader_users where auth_user_id = auth.uid()
    )
    or
    user_id in (
      select tu.id from trader_users tu
      where tu.org_id = (
        select org_id from trader_users
        where auth_user_id = auth.uid() and org_role = 'admin'
      )
      and tu.org_id is not null
    )
  );

create policy "authenticated_delete_trades"
  on trades for delete to authenticated
  using (
    -- only admins can delete (members cannot delete their own)
    user_id in (
      select tu.id from trader_users tu
      where tu.org_id = (
        select org_id from trader_users
        where auth_user_id = auth.uid() and org_role = 'admin'
      )
      and tu.org_id is not null
    )
    or
    -- indie users can delete their own
    (
      user_id in (
        select id from trader_users
        where auth_user_id = auth.uid() and user_type = 'indie'
      )
    )
  );

-- ============================================================
-- ROW LEVEL SECURITY — organisations
-- ============================================================

alter table organisations enable row level security;

create policy "org_members_read"
  on organisations for select to authenticated
  using (
    id in (select org_id from trader_users where auth_user_id = auth.uid())
  );

create policy "org_insert"
  on organisations for insert to authenticated
  with check (true);

create policy "org_admin_update"
  on organisations for update to authenticated
  using (
    id in (
      select org_id from trader_users
      where auth_user_id = auth.uid() and org_role = 'admin'
    )
  );

-- ============================================================
-- ROW LEVEL SECURITY — org_invites
-- ============================================================

alter table org_invites enable row level security;

-- Admins manage invites for their own org
create policy "admin_manage_invites"
  on org_invites for all to authenticated
  using (
    org_id in (
      select org_id from trader_users
      where auth_user_id = auth.uid() and org_role = 'admin'
    )
  )
  with check (
    org_id in (
      select org_id from trader_users
      where auth_user_id = auth.uid() and org_role = 'admin'
    )
  );

-- Anyone authenticated can read an invite by code (for join flow)
create policy "read_invite_by_code"
  on org_invites for select to authenticated
  using (true);

# 002
-- ============================================================
-- migrations/002_fix_rls_recursion.sql
--
-- Fixes infinite recursion in RLS policies caused by
-- auth_trader_id() querying trader_users inside a policy
-- that itself fires on trader_users.
--
-- Root cause:
--   auth_trader_id() does:
--     SELECT id FROM trader_users WHERE auth_user_id = auth.uid()
--   trader_users RLS policies call auth_trader_id()
--   → trader_users policy fires again → infinite loop
--
-- Fix:
--   1. trader_users policies use auth_user_id = auth.uid() directly
--      (no function call, no recursion)
--   2. org_memberships policies use a security-definer view
--      (auth_org_roles) so they never re-enter the policy system
--   3. All other table policies (trades, organisations, etc.)
--      keep using auth_trader_id() — safe because those tables
--      have no policy that loops back through trader_users
-- ============================================================


-- ============================================================
-- 1. TRADER_USERS — rewrite without auth_trader_id()
--    Use auth_user_id = auth.uid() directly to avoid recursion.
-- ============================================================
alter table trader_users enable row level security;

drop policy if exists "own_user_read"          on trader_users;
drop policy if exists "own_user_update"        on trader_users;
drop policy if exists "org_admin_read_members" on trader_users;

-- Own row: compare auth column directly, no helper function
create policy "own_user_read" on trader_users
  for select to authenticated
  using (auth_user_id = auth.uid());

create policy "own_user_update" on trader_users
  for update to authenticated
  using  (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Admins read member rows: join through org_memberships but
-- identify caller by auth_user_id directly (not via function)
create policy "org_admin_read_members" on trader_users
  for select to authenticated
  using (
    exists (
      select 1
      from org_memberships caller_m          -- caller's membership
      join trader_users    caller_u          -- caller's trader_users row
        on caller_u.id = caller_m.user_id
      join org_memberships target_m          -- target's membership
        on target_m.org_id = caller_m.org_id
      where caller_u.auth_user_id = auth.uid()
        and caller_m.org_role in ('owner', 'admin')
        and target_m.user_id = trader_users.id
    )
  );


-- ============================================================
-- 2. SECURITY-DEFINER VIEW for org membership lookup
--    Policies on org_memberships cannot safely call
--    auth_trader_id() (which reads trader_users) because
--    trader_users policies now use auth.uid() directly but
--    org_memberships policies still need to know the caller's
--    user_id.  A security-definer view bypasses RLS entirely.
-- ============================================================
create or replace view auth_org_roles
  with (security_invoker = false)   -- security definer behaviour
as
  select om.org_id, om.org_role
  from   org_memberships om
  join   trader_users    tu on tu.id = om.user_id
  where  tu.auth_user_id = auth.uid();

-- Grant to authenticated so policies can reference it
grant select on auth_org_roles to authenticated;


-- ============================================================
-- 3. ORG_MEMBERSHIPS — rewrite using auth_org_roles view
-- ============================================================
alter table org_memberships enable row level security;

drop policy if exists "own_memberships_read"        on org_memberships;
drop policy if exists "admin_read_org_memberships"  on org_memberships;
drop policy if exists "no_direct_membership_write"  on org_memberships;

-- Users see their own membership rows
create policy "own_memberships_read" on org_memberships
  for select to authenticated
  using (
    user_id = (
      select id from trader_users
      where auth_user_id = auth.uid()
      limit 1
    )
  );

-- Admins see all memberships in orgs they admin
create policy "admin_read_org_memberships" on org_memberships
  for select to authenticated
  using (
    org_id in (
      select org_id from auth_org_roles
      where org_role in ('owner', 'admin')
    )
  );

-- All writes go through security-definer RPCs only
create policy "no_direct_membership_write" on org_memberships
  for all to authenticated
  using (false) with check (false);


-- ============================================================
-- 4. ORGANISATIONS — rewrite using auth_org_roles view
-- ============================================================
alter table organisations enable row level security;

drop policy if exists "org_members_read"  on organisations;
drop policy if exists "org_insert"        on organisations;
drop policy if exists "org_admin_update"  on organisations;

create policy "org_insert" on organisations
  for insert to authenticated
  with check (true);

create policy "org_members_read" on organisations
  for select to authenticated
  using (
    id in (select org_id from auth_org_roles)
  );

create policy "org_admin_update" on organisations
  for update to authenticated
  using (
    id in (
      select org_id from auth_org_roles
      where org_role in ('owner', 'admin')
    )
  );


-- ============================================================
-- 5. ORG_INVITES — rewrite using auth_org_roles view
-- ============================================================
alter table org_invites enable row level security;

drop policy if exists "admin_manage_invites" on org_invites;
drop policy if exists "read_invite_by_code"  on org_invites;

create policy "admin_manage_invites" on org_invites
  for all to authenticated
  using (
    org_id in (
      select org_id from auth_org_roles
      where org_role in ('owner', 'admin')
    )
  )
  with check (
    org_id in (
      select org_id from auth_org_roles
      where org_role in ('owner', 'admin')
    )
  );

create policy "read_invite_by_code" on org_invites
  for select to authenticated
  using (true);


-- ============================================================
-- 6. TRADES — rewrite using auth_org_roles view
-- ============================================================
alter table trades enable row level security;

drop policy if exists "own_trades_read"          on trades;
drop policy if exists "own_trades_insert"         on trades;
drop policy if exists "own_trades_update"         on trades;
drop policy if exists "admin_org_trades_read"     on trades;
drop policy if exists "admin_org_trades_update"   on trades;
drop policy if exists "no_hard_delete_trades"     on trades;

create policy "own_trades_read" on trades
  for select to authenticated
  using (
    user_id = auth_trader_id()
    and deleted_at is null
  );

create policy "own_trades_insert" on trades
  for insert to authenticated
  with check (user_id = auth_trader_id());

create policy "own_trades_update" on trades
  for update to authenticated
  using (
    user_id = auth_trader_id()
    and deleted_at is null
  );

-- Admins read all (including soft-deleted) trades in their orgs
create policy "admin_org_trades_read" on trades
  for select to authenticated
  using (
    user_id in (
      select om.user_id
      from   org_memberships om
      where  om.org_id in (
        select org_id from auth_org_roles
        where org_role in ('owner', 'admin')
      )
    )
  );

create policy "admin_org_trades_update" on trades
  for update to authenticated
  using (
    user_id in (
      select om.user_id
      from   org_memberships om
      where  om.org_id in (
        select org_id from auth_org_roles
        where org_role in ('owner', 'admin')
      )
    )
  );

create policy "no_hard_delete_trades" on trades
  for delete to authenticated
  using (false);


-- ============================================================
-- 7. TRADE_AUDIT_LOG — rewrite using auth_org_roles view
-- ============================================================
alter table trade_audit_log enable row level security;

drop policy if exists "own_trade_audit_read"   on trade_audit_log;
drop policy if exists "admin_audit_read"        on trade_audit_log;
drop policy if exists "no_direct_audit_write"   on trade_audit_log;

create policy "own_trade_audit_read" on trade_audit_log
  for select to authenticated
  using (
    trade_id in (
      select id from trades where user_id = auth_trader_id()
    )
  );

create policy "admin_audit_read" on trade_audit_log
  for select to authenticated
  using (
    trade_id in (
      select t.id
      from   trades t
      join   org_memberships om on om.user_id = t.user_id
      where  om.org_id in (
        select org_id from auth_org_roles
        where org_role in ('owner', 'admin')
      )
    )
  );

create policy "no_direct_audit_write" on trade_audit_log
  for all to authenticated
  using (false) with check (false);


-- ============================================================
-- 8. Grant view access
-- ============================================================
grant select on auth_org_roles to authenticated;

# 003

# 004

# 005

# 006


# 007
-- ============================================================
-- migrations/007_leaderboard_optin.sql
--
-- Adds opt-in leaderboard visibility per membership.
-- Members are ON by default, admins/owners are OFF by default.
-- Anyone can toggle their own visibility.
-- ============================================================

-- Add column
alter table org_memberships
  add column if not exists on_leaderboard boolean not null default true;

-- Admins/owners default to hidden
update org_memberships
set on_leaderboard = false
where org_role in ('owner', 'admin');

-- RPC: toggle own leaderboard visibility
create or replace function toggle_leaderboard_visibility(
  p_org_id uuid,
  p_show   boolean
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from trader_users where auth_user_id = auth.uid();
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'User not found');
  end if;

  update org_memberships
  set on_leaderboard = p_show
  where user_id = v_user_id and org_id = p_org_id;

  return jsonb_build_object('ok', true);
end;
$$;

alter function toggle_leaderboard_visibility(uuid, boolean) owner to postgres;
grant execute on function toggle_leaderboard_visibility(uuid, boolean) to authenticated;

-- Update get_org_leaderboard to respect on_leaderboard flag
create or replace function get_org_leaderboard(
  p_org_id uuid,
  p_sort   text default 'lifetime_pnl'
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_caller_id   uuid;
  v_caller_role text;
  v_is_admin    bool;
  v_month_start timestamptz;
  v_on_lb       bool;
  v_result      jsonb;
begin
  select id into v_caller_id from trader_users where auth_user_id = auth.uid();

  select org_role, on_leaderboard
  into v_caller_role, v_on_lb
  from org_memberships
  where user_id = v_caller_id and org_id = p_org_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  end if;

  v_is_admin    := v_caller_role in ('owner', 'admin');
  v_month_start := date_trunc('month', now());

  if p_sort not in ('lifetime_pnl','monthly_pnl','win_rate','avg_r') then
    p_sort := 'lifetime_pnl';
  end if;

  with stats as (
    select
      tu.id                                                         as user_id,
      tu.display_name,
      tu.avatar_url,
      (tu.id = v_caller_id)                                         as is_current_user,
      om.org_role,
      om.on_leaderboard,
      count(*) filter (
        where t.status in ('CLOSED','STOPPED','TARGET_HIT')
      )::int                                                        as total_closed,
      count(*) filter (where t.status = 'OPEN')::int               as open_trades,
      coalesce(sum(t.realised_pnl) filter (
        where t.status in ('CLOSED','STOPPED','TARGET_HIT')
      ), 0)                                                         as lifetime_pnl,
      coalesce(sum(t.realised_pnl) filter (
        where t.status in ('CLOSED','STOPPED','TARGET_HIT')
          and t.created_at >= v_month_start
      ), 0)                                                         as monthly_pnl,
      case when count(*) filter (
        where t.status in ('CLOSED','STOPPED','TARGET_HIT')
      ) = 0 then null
      else round(
        100.0 * count(*) filter (
          where t.status in ('CLOSED','STOPPED','TARGET_HIT')
            and coalesce(t.realised_pnl,0) > 0
        )::numeric /
        count(*) filter (
          where t.status in ('CLOSED','STOPPED','TARGET_HIT')
        ), 2)
      end                                                           as win_rate,
      case when count(*) filter (
        where t.status in ('CLOSED','STOPPED','TARGET_HIT')
          and coalesce(t.risk_amount,0) > 0
      ) = 0 then null
      else round(
        avg(t.realised_pnl / nullif(t.risk_amount,0)) filter (
          where t.status in ('CLOSED','STOPPED','TARGET_HIT')
            and coalesce(t.risk_amount,0) > 0
        ), 3)
      end                                                           as avg_r
    from org_memberships om
    join trader_users tu on tu.id = om.user_id
    left join trades t on t.user_id = tu.id and t.deleted_at is null
    where om.org_id = p_org_id
      -- Only include members who opted in, OR the caller themselves
      and (om.on_leaderboard = true or tu.id = v_caller_id)
    group by tu.id, tu.display_name, tu.avatar_url, om.org_role, om.on_leaderboard
  ),
  ranked as (
    select *,
      row_number() over (
        order by case p_sort
          when 'lifetime_pnl' then lifetime_pnl
          when 'monthly_pnl'  then monthly_pnl
          when 'win_rate'     then coalesce(win_rate, -1)
          when 'avg_r'        then coalesce(avg_r, -999)
        end desc
      ) as rank
    from stats
  )
  select jsonb_build_object(
    'ok',            true,
    'is_admin',      v_is_admin,
    'i_am_on_lb',    v_on_lb,
    'rows',          jsonb_agg(
      case when v_is_admin then
        jsonb_build_object(
          'rank',            rank,
          'user_id',         user_id,
          'display_name',    display_name,
          'avatar_url',      avatar_url,
          'is_current_user', is_current_user,
          'on_leaderboard',  on_leaderboard,
          'total_closed',    total_closed,
          'open_trades',     open_trades,
          'lifetime_pnl',    lifetime_pnl,
          'monthly_pnl',     monthly_pnl,
          'win_rate',        win_rate,
          'avg_r',           avg_r
        )
      else
        jsonb_build_object(
          'rank',            rank,
          'user_id',         user_id,
          'display_name',    display_name,
          'avatar_url',      avatar_url,
          'is_current_user', is_current_user,
          'on_leaderboard',  on_leaderboard,
          'total_closed',    total_closed,
          'open_trades',     open_trades
        )
      end
      order by rank
    )
  )
  into v_result
  from ranked;

  return v_result;
end;
$$;

alter function get_org_leaderboard(uuid, text) owner to postgres;

# 008
-- ============================================================
-- migrations/008_groups.sql
-- Adds groups within organisations.
-- One member can only belong to one group per org.
-- ============================================================

create table if not exists org_groups (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organisations(id) on delete cascade,
  name       text not null,
  created_by uuid references trader_users(id),
  created_at timestamptz not null default now()
);

create index if not exists org_groups_org_idx on org_groups(org_id);

create table if not exists org_group_members (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references org_groups(id) on delete cascade,
  user_id   uuid not null references trader_users(id) on delete cascade,
  org_id    uuid not null references organisations(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (user_id, org_id)
);

create index if not exists group_members_group_idx on org_group_members(group_id);
create index if not exists group_members_user_idx  on org_group_members(user_id);

-- create_group
create or replace function create_group(p_org_id uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text; v_group_id uuid;
begin
  if p_name is null or trim(p_name) = '' then
    return jsonb_build_object('ok',false,'error','Group name cannot be empty');
  end if;
  select id into v_caller_id from trader_users where auth_user_id = auth.uid();
  select org_role into v_caller_role from org_memberships where user_id=v_caller_id and org_id=p_org_id;
  if v_caller_role not in ('owner','admin') then
    return jsonb_build_object('ok',false,'error','Insufficient permissions');
  end if;
  insert into org_groups (org_id,name,created_by) values (p_org_id,trim(p_name),v_caller_id) returning id into v_group_id;
  return jsonb_build_object('ok',true,'group_id',v_group_id);
end;$$;

-- rename_group
create or replace function rename_group(p_group_id uuid, p_new_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text; v_org_id uuid;
begin
  if p_new_name is null or trim(p_new_name)='' then return jsonb_build_object('ok',false,'error','Name cannot be empty'); end if;
  select id into v_caller_id from trader_users where auth_user_id=auth.uid();
  select org_id into v_org_id from org_groups where id=p_group_id;
  select org_role into v_caller_role from org_memberships where user_id=v_caller_id and org_id=v_org_id;
  if v_caller_role not in ('owner','admin') then return jsonb_build_object('ok',false,'error','Insufficient permissions'); end if;
  update org_groups set name=trim(p_new_name) where id=p_group_id;
  return jsonb_build_object('ok',true);
end;$$;

-- delete_group
create or replace function delete_group(p_group_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text; v_org_id uuid;
begin
  select id into v_caller_id from trader_users where auth_user_id=auth.uid();
  select org_id into v_org_id from org_groups where id=p_group_id;
  select org_role into v_caller_role from org_memberships where user_id=v_caller_id and org_id=v_org_id;
  if v_caller_role not in ('owner','admin') then return jsonb_build_object('ok',false,'error','Insufficient permissions'); end if;
  delete from org_groups where id=p_group_id;
  return jsonb_build_object('ok',true);
end;$$;

-- set_group_member (adds or moves member to a group)
create or replace function set_group_member(p_group_id uuid, p_member_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text; v_org_id uuid;
begin
  select id into v_caller_id from trader_users where auth_user_id=auth.uid();
  select org_id into v_org_id from org_groups where id=p_group_id;
  select org_role into v_caller_role from org_memberships where user_id=v_caller_id and org_id=v_org_id;
  if v_caller_role not in ('owner','admin') then return jsonb_build_object('ok',false,'error','Insufficient permissions'); end if;
  if not exists (select 1 from org_memberships where user_id=p_member_id and org_id=v_org_id) then
    return jsonb_build_object('ok',false,'error','User is not a member of this organisation');
  end if;
  insert into org_group_members (group_id,user_id,org_id) values (p_group_id,p_member_id,v_org_id)
  on conflict (user_id,org_id) do update set group_id=p_group_id, joined_at=now();
  return jsonb_build_object('ok',true);
end;$$;

-- remove_group_member
create or replace function remove_group_member(p_group_id uuid, p_member_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text; v_org_id uuid;
begin
  select id into v_caller_id from trader_users where auth_user_id=auth.uid();
  select org_id into v_org_id from org_groups where id=p_group_id;
  select org_role into v_caller_role from org_memberships where user_id=v_caller_id and org_id=v_org_id;
  if v_caller_role not in ('owner','admin') then return jsonb_build_object('ok',false,'error','Insufficient permissions'); end if;
  delete from org_group_members where group_id=p_group_id and user_id=p_member_id;
  return jsonb_build_object('ok',true);
end;$$;

-- get_org_groups
create or replace function get_org_groups(p_org_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text; v_is_admin bool;
begin
  select id into v_caller_id from trader_users where auth_user_id=auth.uid();
  select org_role into v_caller_role from org_memberships where user_id=v_caller_id and org_id=p_org_id;
  if not found then return jsonb_build_object('ok',false,'error','Not a member of this organisation'); end if;
  v_is_admin := v_caller_role in ('owner','admin');
  return (
    select jsonb_build_object('ok',true,'is_admin',v_is_admin,'groups',jsonb_agg(
      jsonb_build_object(
        'id',g.id,'name',g.name,
        'member_count',coalesce(mc.cnt,0),
        'is_my_group',exists(select 1 from org_group_members where group_id=g.id and user_id=v_caller_id)
      ) order by g.created_at
    ))
    from org_groups g
    left join (select group_id, count(*)::int as cnt from org_group_members group by group_id) mc on mc.group_id=g.id
    where g.org_id=p_org_id
      and (v_is_admin or exists(select 1 from org_group_members where group_id=g.id and user_id=v_caller_id))
  );
end;$$;

-- get_group_leaderboard
create or replace function get_group_leaderboard(p_group_id uuid, p_sort text default 'lifetime_pnl')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_caller_id uuid; v_caller_role text; v_is_admin bool;
  v_on_lb bool; v_org_id uuid; v_month_start timestamptz; v_result jsonb;
begin
  select id into v_caller_id from trader_users where auth_user_id=auth.uid();
  select org_id into v_org_id from org_groups where id=p_group_id;
  select org_role, on_leaderboard into v_caller_role, v_on_lb
  from org_memberships where user_id=v_caller_id and org_id=v_org_id;
  if not found then return jsonb_build_object('ok',false,'error','Not a member of this organisation'); end if;
  v_is_admin := v_caller_role in ('owner','admin');
  v_month_start := date_trunc('month',now());
  if p_sort not in ('lifetime_pnl','monthly_pnl','win_rate','avg_r') then p_sort := 'lifetime_pnl'; end if;

  with stats as (
    select
      tu.id as user_id, tu.display_name, tu.avatar_url,
      (tu.id=v_caller_id) as is_current_user,
      om.org_role, om.on_leaderboard,
      count(*) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT'))::int as total_closed,
      count(*) filter (where t.status='OPEN')::int as open_trades,
      coalesce(sum(t.realised_pnl) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT')),0) as lifetime_pnl,
      coalesce(sum(t.realised_pnl) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT') and t.created_at>=v_month_start),0) as monthly_pnl,
      case when count(*) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT'))=0 then null
        else round(100.0*count(*) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT') and coalesce(t.realised_pnl,0)>0)::numeric
          /count(*) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT')),2) end as win_rate,
      case when count(*) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT') and coalesce(t.risk_amount,0)>0)=0 then null
        else round(avg(t.realised_pnl/nullif(t.risk_amount,0)) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT') and coalesce(t.risk_amount,0)>0),3) end as avg_r
    from org_group_members ogm
    join trader_users tu on tu.id=ogm.user_id
    join org_memberships om on om.user_id=ogm.user_id and om.org_id=v_org_id
    left join trades t on t.user_id=tu.id and t.deleted_at is null
    where ogm.group_id=p_group_id and (om.on_leaderboard=true or tu.id=v_caller_id)
    group by tu.id,tu.display_name,tu.avatar_url,om.org_role,om.on_leaderboard
  ),
  ranked as (
    select *, row_number() over (order by case p_sort
      when 'lifetime_pnl' then lifetime_pnl when 'monthly_pnl' then monthly_pnl
      when 'win_rate' then coalesce(win_rate,-1) when 'avg_r' then coalesce(avg_r,-999)
    end desc) as rank from stats
  )
  select jsonb_build_object('ok',true,'is_admin',v_is_admin,'i_am_on_lb',v_on_lb,'group_id',p_group_id,
    'rows',jsonb_agg(
      case when v_is_admin then jsonb_build_object('rank',rank,'user_id',user_id,'display_name',display_name,
        'avatar_url',avatar_url,'is_current_user',is_current_user,'on_leaderboard',on_leaderboard,
        'total_closed',total_closed,'open_trades',open_trades,'lifetime_pnl',lifetime_pnl,
        'monthly_pnl',monthly_pnl,'win_rate',win_rate,'avg_r',avg_r)
      else jsonb_build_object('rank',rank,'user_id',user_id,'display_name',display_name,
        'avatar_url',avatar_url,'is_current_user',is_current_user,'on_leaderboard',on_leaderboard,
        'total_closed',total_closed,'open_trades',open_trades)
      end order by rank
    )
  ) into v_result from ranked;

  return coalesce(v_result, jsonb_build_object('ok',true,'is_admin',v_is_admin,'i_am_on_lb',v_on_lb,'group_id',p_group_id,'rows','[]'::jsonb));
end;$$;

alter function create_group(uuid,text)          owner to postgres;
alter function rename_group(uuid,text)          owner to postgres;
alter function delete_group(uuid)               owner to postgres;
alter function set_group_member(uuid,uuid)      owner to postgres;
alter function remove_group_member(uuid,uuid)   owner to postgres;
alter function get_org_groups(uuid)             owner to postgres;
alter function get_group_leaderboard(uuid,text) owner to postgres;

grant execute on function create_group(uuid,text)          to authenticated;
grant execute on function rename_group(uuid,text)          to authenticated;
grant execute on function delete_group(uuid)               to authenticated;
grant execute on function set_group_member(uuid,uuid)      to authenticated;
grant execute on function remove_group_member(uuid,uuid)   to authenticated;
grant execute on function get_org_groups(uuid)             to authenticated;
grant execute on function get_group_leaderboard(uuid,text) to authenticated;

grant select,insert,update,delete on public.org_groups        to authenticated;
grant select,insert,update,delete on public.org_group_members to authenticated;


# 009

-- ================================================================
-- 009_super_admin.sql
--
-- Adds three SECURITY DEFINER RPCs for platform-level super admin.
-- All check trader_users.role = 'admin' on the caller before acting.
-- No schema changes needed — trader_users.role already exists.
--
-- Run in: Supabase → SQL Editor
--
-- After running, grant yourself super admin:
--   UPDATE trader_users
--   SET role = 'admin'
--   WHERE auth_user_id = auth.uid();   -- run as yourself in SQL editor
-- Or by email:
--   UPDATE trader_users tu
--   SET role = 'admin'
--   FROM auth.users au
--   WHERE au.id = tu.auth_user_id
--     AND au.email = 'your@email.com';
-- ================================================================


-- ── Helper: resolve caller to trader_users row ────────────────
-- Reuses the existing pattern from auth_trader_id() if it exists,
-- otherwise re-implements inline in each RPC.


-- ================================================================
-- 1. super_admin_list_orgs
--    Returns every org with member count + owner info.
-- ================================================================
CREATE OR REPLACE FUNCTION super_admin_list_orgs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   uuid;
  v_caller_role text;
BEGIN
  -- Resolve caller
  SELECT tu.id, tu.role
    INTO v_caller_id, v_caller_role
    FROM trader_users tu
   WHERE tu.auth_user_id = auth.uid()
   LIMIT 1;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorised');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'orgs', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',           o.id,
          'name',         o.name,
          'slug',         o.slug,
          'domain',       o.domain,
          'currency',     o.currency,
          'created_at',   o.created_at,
          'member_count', (
            SELECT COUNT(*)
              FROM org_memberships om
             WHERE om.org_id = o.id
          ),
          'owner_name', (
            SELECT tu2.display_name
              FROM org_memberships om2
              JOIN trader_users tu2 ON tu2.id = om2.user_id
             WHERE om2.org_id   = o.id
               AND om2.org_role = 'owner'
             LIMIT 1
          ),
          'owner_email', (
            SELECT au.email
              FROM org_memberships om3
              JOIN trader_users tu3 ON tu3.id = om3.user_id
              JOIN auth.users   au  ON au.id  = tu3.auth_user_id
             WHERE om3.org_id   = o.id
               AND om3.org_role = 'owner'
             LIMIT 1
          )
        )
        ORDER BY o.created_at DESC
      )
      FROM organisations o
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION super_admin_list_orgs() TO authenticated;


-- ================================================================
-- 2. super_admin_create_org
--    Creates an org and assigns an existing user as owner,
--    identified by email. The target user does not need to be
--    an org_admin yet — this sets their user_type too.
-- ================================================================
CREATE OR REPLACE FUNCTION super_admin_create_org(
  p_name       text,
  p_owner_email text,
  p_domain     text    DEFAULT NULL,
  p_currency   text    DEFAULT 'INR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role  text;
  v_owner_auth   uuid;
  v_owner_id     uuid;
  v_org_id       uuid;
  v_slug         text;
BEGIN
  -- Auth check
  SELECT tu.role
    INTO v_caller_role
    FROM trader_users tu
   WHERE tu.auth_user_id = auth.uid()
   LIMIT 1;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorised');
  END IF;

  -- Resolve owner by email
  SELECT au.id INTO v_owner_auth
    FROM auth.users au
   WHERE au.email = p_owner_email
   LIMIT 1;

  IF v_owner_auth IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No user found with that email');
  END IF;

  SELECT tu.id INTO v_owner_id
    FROM trader_users tu
   WHERE tu.auth_user_id = v_owner_auth
   LIMIT 1;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User has not completed sign-in yet');
  END IF;

  -- Check owner not already in an org
  IF EXISTS (
    SELECT 1 FROM org_memberships om WHERE om.user_id = v_owner_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That user is already a member of an organisation');
  END IF;

  -- Generate slug from name
  v_slug := lower(regexp_replace(trim(p_name), '[^a-z0-9]+', '-', 'g'));
  v_org_id := gen_random_uuid();

  -- Create org
  INSERT INTO organisations (id, name, slug, domain, currency)
  VALUES (v_org_id, p_name, v_slug, p_domain, p_currency);

  -- Create owner membership
  INSERT INTO org_memberships (user_id, org_id, org_role, joined_at)
  VALUES (v_owner_id, v_org_id, 'owner', now());

  -- Update owner's trader_users row
  UPDATE trader_users
     SET user_type = 'org_admin',
         org_id    = v_org_id,
         org_role  = 'owner'
   WHERE id = v_owner_id;

  RETURN jsonb_build_object(
    'ok',     true,
    'org_id', v_org_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION super_admin_create_org(text, text, text, text) TO authenticated;


-- ================================================================
-- 3. super_admin_delete_org
--    Same logic as delete_organisation but skips the ownership
--    check — callable by any super admin.
-- ================================================================
CREATE OR REPLACE FUNCTION super_admin_delete_org(
  p_org_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  -- Auth check
  SELECT tu.role
    INTO v_caller_role
    FROM trader_users tu
   WHERE tu.auth_user_id = auth.uid()
   LIMIT 1;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorised');
  END IF;

  -- Verify org exists
  IF NOT EXISTS (SELECT 1 FROM organisations WHERE id = p_org_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Organisation not found');
  END IF;

  -- Reset all members to indie
  UPDATE trader_users
     SET user_type = 'indie',
         org_id    = NULL,
         org_role  = NULL
   WHERE id IN (
     SELECT user_id FROM org_memberships WHERE org_id = p_org_id
   );

  -- Cascade: memberships, groups, invites
  DELETE FROM org_group_members
   WHERE group_id IN (
     SELECT id FROM org_groups WHERE org_id = p_org_id
   );
  DELETE FROM org_groups       WHERE org_id = p_org_id;
  DELETE FROM org_memberships  WHERE org_id = p_org_id;
  DELETE FROM org_invites      WHERE org_id = p_org_id;
  DELETE FROM organisations    WHERE id     = p_org_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION super_admin_delete_org(uuid) TO authenticated;


-- ================================================================
-- 4. super_admin_get_org_detail
--    Full org snapshot for the /super/[orgId] detail page:
--    members (with groups), groups (with counts), basic org info.
-- ================================================================
CREATE OR REPLACE FUNCTION super_admin_get_org_detail(
  p_org_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  SELECT tu.role
    INTO v_caller_role
    FROM trader_users tu
   WHERE tu.auth_user_id = auth.uid()
   LIMIT 1;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorised');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,

    'org', (
      SELECT row_to_json(o)
        FROM organisations o
       WHERE o.id = p_org_id
    ),

    'members', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',            tu.id,
          'display_name',  tu.display_name,
          'avatar_url',    tu.avatar_url,
          'email',         au.email,
          'org_role',      om.org_role,
          'capital_limit', COALESCE(tu.capital_limit, 100000),
          'joined_at',     om.joined_at,
          'group_id',      ogm.group_id,
          'group_name',    og.name
        )
        ORDER BY om.joined_at
      )
      FROM org_memberships om
      JOIN trader_users tu ON tu.id = om.user_id
      LEFT JOIN auth.users au ON au.id = tu.auth_user_id
      LEFT JOIN org_group_members ogm ON ogm.user_id = tu.id AND ogm.org_id = p_org_id
      LEFT JOIN org_groups og ON og.id = ogm.group_id
      WHERE om.org_id = p_org_id
    ),

    'groups', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',           og.id,
          'name',         og.name,
          'member_count', (
            SELECT COUNT(*) FROM org_group_members ogm2
             WHERE ogm2.group_id = og.id
          )
        )
        ORDER BY og.name
      )
      FROM org_groups og
      WHERE og.org_id = p_org_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION super_admin_get_org_detail(uuid) TO authenticated;



# 010

-- ============================================================
-- migrations/010_currency.sql
-- Adds currency selection to organisations and indie users.
-- "INR" = Indian markets (NSE/BSE)
-- "USD" = US markets (NYSE/NASDAQ)
-- ============================================================

-- Add currency to organisations
alter table organisations
  add column if not exists currency text not null default 'INR'
    check (currency in ('INR', 'USD'));

-- Add currency to trader_users (for indie users)
alter table trader_users
  add column if not exists currency text not null default 'INR'
    check (currency in ('INR', 'USD'));

-- Update create_org_with_owner to accept currency
create or replace function create_org_with_owner(
  p_name     text,
  p_domain   text    default null,
  p_currency text    default 'INR'
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id  uuid;
  v_slug    text;
  v_cur     text;
begin
  select id into v_user_id from trader_users where auth_user_id = auth.uid();
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'User not found');
  end if;

  v_cur  := case when p_currency = 'USD' then 'USD' else 'INR' end;
  v_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug) || '-' || floor(extract(epoch from now()))::text;

  insert into organisations (name, slug, domain, currency)
  values (p_name, v_slug, nullif(trim(coalesce(p_domain,'')), ''), v_cur)
  returning id into v_org_id;

  insert into org_memberships (user_id, org_id, org_role)
  values (v_user_id, v_org_id, 'owner');

  -- Sync user currency to match org
  update trader_users
  set user_type = 'org_admin', org_id = v_org_id, org_role = 'admin', currency = v_cur
  where id = v_user_id;

  return jsonb_build_object('ok', true, 'org_id', v_org_id, 'currency', v_cur);
end;
$$;

alter function create_org_with_owner(text, text, text) owner to postgres;
grant execute on function create_org_with_owner(text, text, text) to authenticated;

-- Update validate_and_accept_invite to sync currency from org to user
create or replace function validate_and_accept_invite(p_code text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_invite  org_invites%rowtype;
  v_org     organisations%rowtype;
  v_user_id uuid;
  v_email   text;
  v_role    text;
begin
  select id into v_user_id from trader_users where auth_user_id = auth.uid();
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'User not found');
  end if;

  select email into v_email from auth.users where id = auth.uid();

  select * into v_invite from org_invites where code = p_code;
  if not found then return jsonb_build_object('ok', false, 'error', 'Invite not found'); end if;
  if v_invite.expires_at < now() then return jsonb_build_object('ok', false, 'error', 'Invite has expired'); end if;
  if v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then
    return jsonb_build_object('ok', false, 'error', 'Invite has reached its usage limit');
  end if;
  if exists (select 1 from org_memberships where user_id = v_user_id and org_id = v_invite.org_id) then
    return jsonb_build_object('ok', false, 'error', 'You are already a member of this organisation');
  end if;

  select * into v_org from organisations where id = v_invite.org_id;
  if v_org.domain is not null then
    if v_email not ilike '%@' || v_org.domain then
      return jsonb_build_object('ok', false, 'error', 'Your email domain is not allowed for this organisation');
    end if;
  end if;

  v_role := coalesce(v_invite.role, 'member');

  insert into org_memberships (user_id, org_id, org_role)
  values (v_user_id, v_invite.org_id, v_role);

  -- Sync currency from org to user
  update trader_users
  set
    user_type = case when v_role = 'admin' then 'org_admin' else 'org_member' end,
    org_id    = v_invite.org_id,
    org_role  = v_role,
    currency  = v_org.currency
  where id = v_user_id;

  update org_invites set use_count = use_count + 1 where id = v_invite.id;

  return jsonb_build_object('ok', true, 'org_id', v_invite.org_id, 'role', v_role, 'currency', v_org.currency);
end;
$$;

alter function validate_and_accept_invite(text) owner to postgres;
grant execute on function validate_and_accept_invite(text) to authenticated;



-- Backfill role = 'admin' for all current org owners
UPDATE trader_users tu
SET role = 'admin'
FROM org_memberships om
WHERE om.user_id = tu.id
  AND om.org_role = 'owner';

-- Relax create_org_with_owner to allow super admins to create multiple orgs
-- (update the existing RPC to skip the "already in org" check for role = 'admin')

-- ================================================================
-- 010_super_admin_owners.sql
--
-- 1. Backfill role = 'admin' for all existing org owners
-- 2. Add active_org_id to trader_users for multi-org switching
-- 3. Update create_org_with_owner to allow super admins to create
--    multiple orgs (skip the "already a member" guard for them)
-- 4. New RPC: super_admin_set_active_org — switches the active org
--    for the calling super admin
-- 5. Trigger: auto-grant role = 'admin' when someone becomes an
--    org owner going forward
--
-- Run in: Supabase → SQL Editor
-- ================================================================


-- ── 1. Backfill existing owners ───────────────────────────────
UPDATE trader_users tu
SET    role = 'admin'
FROM   org_memberships om
WHERE  om.user_id  = tu.id
  AND  om.org_role = 'owner'
  AND  tu.role     = 'user';   -- only touch rows not already admin


-- ── 2. Add active_org_id column ──────────────────────────────
-- Tracks which org the super admin is currently "acting as".
-- NULL means use the first membership (default behaviour for
-- regular single-org users, so no existing code breaks).
ALTER TABLE trader_users
  ADD COLUMN IF NOT EXISTS active_org_id uuid
    REFERENCES organisations(id) ON DELETE SET NULL;

-- Seed active_org_id for existing owners so their current org
-- stays selected after the migration.
UPDATE trader_users tu
SET    active_org_id = (
  SELECT om.org_id
  FROM   org_memberships om
  WHERE  om.user_id  = tu.id
    AND  om.org_role = 'owner'
  ORDER  BY om.joined_at ASC
  LIMIT  1
)
WHERE  tu.role = 'admin'
  AND  tu.active_org_id IS NULL;


-- ── 3. Replace create_org_with_owner ─────────────────────────
-- Original blocked callers who were already members.
-- New version: super admins (role = 'admin') skip that check
-- and get active_org_id updated to the new org.
CREATE OR REPLACE FUNCTION create_org_with_owner(
  p_name     text,
  p_domain   text    DEFAULT NULL,
  p_currency text    DEFAULT 'INR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id    uuid;
  v_caller_role  text;
  v_org_id       uuid;
  v_slug         text;
BEGIN
  -- Resolve caller
  SELECT tu.id, tu.role
    INTO v_caller_id, v_caller_role
    FROM trader_users tu
   WHERE tu.auth_user_id = auth.uid()
   LIMIT 1;

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  -- Regular users: block if already a member of any org
  IF v_caller_role != 'admin' AND EXISTS (
    SELECT 1 FROM org_memberships WHERE user_id = v_caller_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already a member of an organisation');
  END IF;

  -- Generate slug
  v_slug   := lower(regexp_replace(trim(p_name), '[^a-z0-9]+', '-', 'g'));
  v_org_id := gen_random_uuid();

  -- Create org
  INSERT INTO organisations (id, name, slug, domain, currency)
  VALUES (v_org_id, p_name, v_slug, p_domain, p_currency);

  -- Create owner membership
  INSERT INTO org_memberships (user_id, org_id, org_role, joined_at)
  VALUES (v_caller_id, v_org_id, 'owner', now())
  ON CONFLICT (user_id, org_id) DO NOTHING;

  -- Update trader_users — always set active_org_id; only update
  -- user_type + legacy columns for regular users (super admins
  -- keep user_type = 'org_admin' from their primary org).
  IF v_caller_role = 'admin' THEN
    UPDATE trader_users
       SET active_org_id = v_org_id
     WHERE id = v_caller_id;
  ELSE
    UPDATE trader_users
       SET user_type     = 'org_admin',
           org_id        = v_org_id,
           org_role      = 'owner',
           active_org_id = v_org_id
     WHERE id = v_caller_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'org_id', v_org_id);
END;
$$;


-- ── 4. RPC: super_admin_set_active_org ───────────────────────
-- Super admin switches which org they're managing.
-- Returns error if they're not an owner of that org.
CREATE OR REPLACE FUNCTION super_admin_set_active_org(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   uuid;
  v_caller_role text;
BEGIN
  SELECT tu.id, tu.role
    INTO v_caller_id, v_caller_role
    FROM trader_users tu
   WHERE tu.auth_user_id = auth.uid()
   LIMIT 1;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorised');
  END IF;

  -- Must be a member of the target org
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships
     WHERE user_id = v_caller_id AND org_id = p_org_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of that organisation');
  END IF;

  UPDATE trader_users
     SET active_org_id = p_org_id,
         -- Keep legacy columns in sync so existing pages still work
         org_id        = p_org_id,
         org_role      = (
           SELECT org_role FROM org_memberships
            WHERE user_id = v_caller_id AND org_id = p_org_id
         )
   WHERE id = v_caller_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION super_admin_set_active_org(uuid) TO authenticated;


-- ── 5. Trigger: auto-grant admin role on new ownership ────────
-- Fires after INSERT on org_memberships where org_role = 'owner'.
-- Means any future org created via onboarding also grants admin.
CREATE OR REPLACE FUNCTION _grant_admin_on_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_role = 'owner' THEN
    UPDATE trader_users
       SET role = 'admin'
     WHERE id   = NEW.user_id
       AND role = 'user';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_admin_on_owner ON org_memberships;
CREATE TRIGGER trg_grant_admin_on_owner
  AFTER INSERT ON org_memberships
  FOR EACH ROW EXECUTE FUNCTION _grant_admin_on_owner();


# 011
-- ================================================================
-- 011_scope_super_admin_to_own_orgs.sql
--
-- Replaces the four super_admin_* RPCs so they only operate on
-- orgs the caller is a member of. Super admins are multi-org
-- owners — not platform gods with access to everyone's data.
--
-- Changes per RPC:
--   super_admin_list_orgs        — filtered to caller's memberships
--   super_admin_get_org_detail   — must be a member of that org
--   super_admin_delete_org       — must be the owner of that org
--   super_admin_create_org       — removed p_owner_email (creates
--                                  for the caller themselves, same
--                                  as create_org_with_owner but
--                                  without the single-org limit)
-- ================================================================


-- ================================================================
-- 1. super_admin_list_orgs — own orgs only
-- ================================================================
CREATE OR REPLACE FUNCTION super_admin_list_orgs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   uuid;
  v_caller_role text;
BEGIN
  SELECT tu.id, tu.role
    INTO v_caller_id, v_caller_role
    FROM trader_users tu
   WHERE tu.auth_user_id = auth.uid()
   LIMIT 1;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorised');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'orgs', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',           o.id,
          'name',         o.name,
          'slug',         o.slug,
          'domain',       o.domain,
          'currency',     o.currency,
          'created_at',   o.created_at,
          'my_role',      om_me.org_role,
          'member_count', (
            SELECT COUNT(*)
              FROM org_memberships om2
             WHERE om2.org_id = o.id
          )
        )
        ORDER BY om_me.joined_at ASC
      )
      FROM org_memberships om_me
      JOIN organisations   o      ON o.id = om_me.org_id
      WHERE om_me.user_id = v_caller_id   -- only orgs I belong to
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION super_admin_list_orgs() TO authenticated;


-- ================================================================
-- 2. super_admin_get_org_detail — must be a member of that org
-- ================================================================
CREATE OR REPLACE FUNCTION super_admin_get_org_detail(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   uuid;
  v_caller_role text;
BEGIN
  SELECT tu.id, tu.role
    INTO v_caller_id, v_caller_role
    FROM trader_users tu
   WHERE tu.auth_user_id = auth.uid()
   LIMIT 1;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorised');
  END IF;

  -- Must be a member of the requested org
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships
     WHERE user_id = v_caller_id AND org_id = p_org_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Organisation not found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,

    'org', (
      SELECT row_to_json(o)
        FROM organisations o
       WHERE o.id = p_org_id
    ),

    'members', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',            tu.id,
          'display_name',  tu.display_name,
          'avatar_url',    tu.avatar_url,
          'email',         au.email,
          'org_role',      om.org_role,
          'capital_limit', COALESCE(tu.capital_limit, 100000),
          'joined_at',     om.joined_at,
          'group_id',      ogm.group_id,
          'group_name',    og.name
        )
        ORDER BY om.joined_at
      )
      FROM org_memberships om
      JOIN trader_users tu ON tu.id = om.user_id
      LEFT JOIN auth.users         au  ON au.id       = tu.auth_user_id
      LEFT JOIN org_group_members  ogm ON ogm.user_id = tu.id AND ogm.org_id = p_org_id
      LEFT JOIN org_groups         og  ON og.id       = ogm.group_id
      WHERE om.org_id = p_org_id
    ),

    'groups', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',           og.id,
          'name',         og.name,
          'member_count', (
            SELECT COUNT(*) FROM org_group_members ogm2
             WHERE ogm2.group_id = og.id
          )
        )
        ORDER BY og.name
      )
      FROM org_groups og
      WHERE og.org_id = p_org_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION super_admin_get_org_detail(uuid) TO authenticated;


-- ================================================================
-- 3. super_admin_delete_org — must be the OWNER of that org
-- ================================================================
CREATE OR REPLACE FUNCTION super_admin_delete_org(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   uuid;
  v_caller_role text;
  v_my_org_role text;
BEGIN
  SELECT tu.id, tu.role
    INTO v_caller_id, v_caller_role
    FROM trader_users tu
   WHERE tu.auth_user_id = auth.uid()
   LIMIT 1;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorised');
  END IF;

  -- Must be owner of that specific org
  SELECT org_role INTO v_my_org_role
    FROM org_memberships
   WHERE user_id = v_caller_id AND org_id = p_org_id;

  IF v_my_org_role IS DISTINCT FROM 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You are not the owner of this organisation');
  END IF;

  -- Reset all members to indie (except caller — handled below)
  UPDATE trader_users
     SET user_type = 'indie',
         org_id    = NULL,
         org_role  = NULL
   WHERE id IN (
     SELECT user_id FROM org_memberships WHERE org_id = p_org_id
   );

  -- Cascade: groups, memberships, invites, org
  DELETE FROM org_group_members
   WHERE group_id IN (SELECT id FROM org_groups WHERE org_id = p_org_id);
  DELETE FROM org_groups      WHERE org_id = p_org_id;
  DELETE FROM org_memberships WHERE org_id = p_org_id;
  DELETE FROM org_invites     WHERE org_id = p_org_id;
  DELETE FROM organisations   WHERE id     = p_org_id;

  -- If caller still has other orgs, restore org_admin + point to first remaining org
  UPDATE trader_users tu
     SET user_type = 'org_admin',
         org_id    = (
           SELECT org_id FROM org_memberships
            WHERE user_id = v_caller_id
            ORDER BY joined_at ASC
            LIMIT 1
         ),
         org_role  = (
           SELECT org_role FROM org_memberships
            WHERE user_id = v_caller_id
            ORDER BY joined_at ASC
            LIMIT 1
         ),
         active_org_id = (
           SELECT org_id FROM org_memberships
            WHERE user_id = v_caller_id
            ORDER BY joined_at ASC
            LIMIT 1
         )
   WHERE tu.id = v_caller_id
     AND EXISTS (
       SELECT 1 FROM org_memberships WHERE user_id = v_caller_id
     );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION super_admin_delete_org(uuid) TO authenticated;


-- ================================================================
-- 4. super_admin_create_org — creates for the caller themselves
--    (drop the p_owner_email param — callers create their own orgs)
--    This is now just an alias for create_org_with_owner but the
--    old 4-param version is left in place so /super/new still
--    compiles; we add a new 3-param version for self-creation.
-- ================================================================
CREATE OR REPLACE FUNCTION super_admin_create_org(
  p_name     text,
  p_domain   text  DEFAULT NULL,
  p_currency text  DEFAULT 'INR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delegate entirely to create_org_with_owner which already
  -- handles the super-admin multi-org case (see migration 010).
  RETURN create_org_with_owner(p_name, p_domain, p_currency);
END;
$$;

GRANT EXECUTE ON FUNCTION super_admin_create_org(text, text, text) TO authenticated;


# 012
-- ================================================================
-- 012_co_owner_and_invisibility.sql
--
-- 1. get_org_members_with_profiles — exclude super admins
--    (role = 'admin') so they're invisible to regular members,
--    org owners, and the leaderboard.
--
-- 2. super_admin_get_org_detail — add is_super_admin flag per
--    member row so the /super/[orgId] page can show them
--    distinctly while still hiding them everywhere else.
--
-- 3. super_admin_assign_co_owner(org_id, email) — new RPC.
--    Rules:
--      - Caller must be a super admin AND owner of the org
--      - Target user must exist and not be a super admin
--      - Org can have at most 1 non-super-admin owner
--      - Replaces any existing non-super-admin owner with 'admin'
--        role before assigning the new one (one owner at a time)
--      - Super admin themselves stays as owner, stays invisible
-- ================================================================


-- ================================================================
-- 1. Hide super admins from get_org_members_with_profiles
-- ================================================================
CREATE OR REPLACE FUNCTION get_org_members_with_profiles(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   uuid;
  v_caller_role text;
BEGIN
  SELECT tu.id, tu.role
    INTO v_caller_id, v_caller_role
    FROM trader_users tu
   WHERE tu.auth_user_id = auth.uid()
   LIMIT 1;

  -- Must be a member of the org
  IF NOT EXISTS (
    SELECT 1 FROM org_memberships
     WHERE user_id = v_caller_id AND org_id = p_org_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorised');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'is_admin', (
      SELECT org_role IN ('owner', 'admin')
        FROM org_memberships
       WHERE user_id = v_caller_id AND org_id = p_org_id
    ),
    'members', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',            tu.id,
          'display_name',  tu.display_name,
          'avatar_url',    tu.avatar_url,
          'org_role',      om.org_role,
          'capital_limit', COALESCE(tu.capital_limit, 100000),
          'joined_at',     om.joined_at
        )
        ORDER BY om.joined_at
      )
      FROM org_memberships om
      JOIN trader_users tu ON tu.id = om.user_id
      WHERE om.org_id  = p_org_id
        AND tu.role    != 'admin'    -- ← super admins invisible here
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_org_members_with_profiles(uuid) TO authenticated;


-- ================================================================
-- 2. super_admin_get_org_detail — flag is_super_admin per member
-- ================================================================
CREATE OR REPLACE FUNCTION super_admin_get_org_detail(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   uuid;
  v_caller_role text;
BEGIN
  SELECT tu.id, tu.role
    INTO v_caller_id, v_caller_role
    FROM trader_users tu
   WHERE tu.auth_user_id = auth.uid()
   LIMIT 1;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorised');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM org_memberships
     WHERE user_id = v_caller_id AND org_id = p_org_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Organisation not found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,

    'org', (
      SELECT row_to_json(o) FROM organisations o WHERE o.id = p_org_id
    ),

    -- ALL members including super admins, flagged with is_super_admin
    'members', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',             tu.id,
          'display_name',   tu.display_name,
          'avatar_url',     tu.avatar_url,
          'email',          au.email,
          'org_role',       om.org_role,
          'capital_limit',  COALESCE(tu.capital_limit, 100000),
          'joined_at',      om.joined_at,
          'group_id',       ogm.group_id,
          'group_name',     og.name,
          'is_super_admin', (tu.role = 'admin')   -- ← flag
        )
        ORDER BY om.joined_at
      )
      FROM org_memberships om
      JOIN trader_users tu ON tu.id = om.user_id
      LEFT JOIN auth.users        au  ON au.id       = tu.auth_user_id
      LEFT JOIN org_group_members ogm ON ogm.user_id = tu.id
                                     AND ogm.org_id  = p_org_id
      LEFT JOIN org_groups        og  ON og.id       = ogm.group_id
      WHERE om.org_id = p_org_id
    ),

    'groups', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',           og.id,
          'name',         og.name,
          'member_count', (
            SELECT COUNT(*) FROM org_group_members ogm2
             WHERE ogm2.group_id = og.id
          )
        )
        ORDER BY og.name
      )
      FROM org_groups og WHERE og.org_id = p_org_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION super_admin_get_org_detail(uuid) TO authenticated;


-- ================================================================
-- 3. super_admin_assign_co_owner
-- ================================================================
CREATE OR REPLACE FUNCTION super_admin_assign_co_owner(
  p_org_id uuid,
  p_email  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id    uuid;
  v_caller_role  text;
  v_caller_org_role text;
  v_target_auth  uuid;
  v_target_id    uuid;
  v_target_role  text;
BEGIN
  -- Caller must be super admin
  SELECT tu.id, tu.role
    INTO v_caller_id, v_caller_role
    FROM trader_users tu
   WHERE tu.auth_user_id = auth.uid()
   LIMIT 1;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorised');
  END IF;

  -- Caller must be owner of this org
  SELECT org_role INTO v_caller_org_role
    FROM org_memberships
   WHERE user_id = v_caller_id AND org_id = p_org_id;

  IF v_caller_org_role IS DISTINCT FROM 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You are not the owner of this organisation');
  END IF;

  -- Resolve target user by email
  SELECT au.id INTO v_target_auth
    FROM auth.users au
   WHERE lower(au.email) = lower(p_email)
   LIMIT 1;

  IF v_target_auth IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No user found with that email');
  END IF;

  SELECT tu.id, tu.role
    INTO v_target_id, v_target_role
    FROM trader_users tu
   WHERE tu.auth_user_id = v_target_auth
   LIMIT 1;

  IF v_target_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User has not signed in yet');
  END IF;

  -- Cannot assign another super admin as co-owner
  IF v_target_role = 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot assign a super admin as co-owner');
  END IF;

  -- Cannot assign yourself
  IF v_target_id = v_caller_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You are already the owner');
  END IF;

  -- Demote any existing non-super-admin owner to admin
  -- (enforces max 1 co-owner at a time)
  UPDATE org_memberships om
     SET org_role = 'admin'
    FROM trader_users tu
   WHERE tu.id          = om.user_id
     AND om.org_id      = p_org_id
     AND om.org_role    = 'owner'
     AND tu.role       != 'admin'    -- don't touch super admin
     AND om.user_id    != v_target_id;

  -- Add or promote target to owner
  INSERT INTO org_memberships (user_id, org_id, org_role, joined_at)
  VALUES (v_target_id, p_org_id, 'owner', now())
  ON CONFLICT (user_id, org_id) DO UPDATE SET org_role = 'owner';

  -- Update target's trader_users so their dashboard works
  UPDATE trader_users
     SET user_type = 'org_admin',
         org_id    = p_org_id,
         org_role  = 'owner'
   WHERE id = v_target_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION super_admin_assign_co_owner(uuid, text) TO authenticated;



# 013
-- ================================================================
-- 013_fix_set_active_org.sql
--
-- Fixes: "new row for relation trader_users violates check
-- constraint trader_users_org_role_check"
--
-- Root cause: super_admin_set_active_org was writing the value
-- from org_memberships.org_role ('owner') directly into
-- trader_users.org_role, which has a different allowed set.
--
-- Fix: only update active_org_id. The legacy org_id / org_role
-- columns on trader_users are not needed for the switcher —
-- org_memberships is the source of truth.
-- ================================================================

CREATE OR REPLACE FUNCTION super_admin_set_active_org(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   uuid;
  v_caller_role text;
BEGIN
  SELECT tu.id, tu.role
    INTO v_caller_id, v_caller_role
    FROM trader_users tu
   WHERE tu.auth_user_id = auth.uid()
   LIMIT 1;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorised');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM org_memberships
     WHERE user_id = v_caller_id AND org_id = p_org_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of that organisation');
  END IF;

  -- Only update active_org_id — do NOT touch the legacy org_role
  -- column on trader_users (different enum, causes constraint violation)
  UPDATE trader_users
     SET active_org_id = p_org_id,
         org_id        = p_org_id
   WHERE id = v_caller_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION super_admin_set_active_org(uuid) TO authenticated;

# 014

-- ================================================================
-- 014_fix_delete_org.sql
--
-- Fixes: "new row for relation trader_users violates check
-- constraint trader_users_org_role_check" on org delete.
--
-- Root cause: two UPDATE statements in super_admin_delete_org
-- were writing to trader_users.org_role:
--   1. SET org_role = NULL   (constraint doesn't allow NULL)
--   2. SET org_role = (SELECT org_role FROM org_memberships ...)
--      which is 'owner'/'admin'/'member' — wrong enum for
--      the trader_users column
--
-- Fix: stop touching trader_users.org_role entirely — it's a
-- legacy column, nothing reads it directly, org_memberships
-- is the source of truth.
-- ================================================================

CREATE OR REPLACE FUNCTION super_admin_delete_org(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id    uuid;
  v_caller_role  text;
  v_my_org_role  text;
  v_next_org_id  uuid;
BEGIN
  SELECT tu.id, tu.role
    INTO v_caller_id, v_caller_role
    FROM trader_users tu
   WHERE tu.auth_user_id = auth.uid()
   LIMIT 1;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorised');
  END IF;

  SELECT org_role INTO v_my_org_role
    FROM org_memberships
   WHERE user_id = v_caller_id AND org_id = p_org_id;

  IF v_my_org_role IS DISTINCT FROM 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You are not the owner of this organisation');
  END IF;

  -- Reset non-super-admin members to indie
  -- Do NOT touch org_role — it's a legacy column with its own
  -- check constraint that conflicts with org_memberships values
  UPDATE trader_users
     SET user_type = 'indie',
         org_id    = NULL
   WHERE id IN (
     SELECT user_id FROM org_memberships WHERE org_id = p_org_id
   )
     AND role != 'admin';   -- leave super admins alone

  -- Cascade deletes
  DELETE FROM org_group_members
   WHERE group_id IN (SELECT id FROM org_groups WHERE org_id = p_org_id);
  DELETE FROM org_groups      WHERE org_id = p_org_id;
  DELETE FROM org_memberships WHERE org_id = p_org_id;
  DELETE FROM org_invites     WHERE org_id = p_org_id;
  DELETE FROM organisations   WHERE id     = p_org_id;

  -- Point caller to their next org if they have one, otherwise indie
  SELECT org_id INTO v_next_org_id
    FROM org_memberships
   WHERE user_id = v_caller_id
   ORDER BY joined_at ASC
   LIMIT 1;

  IF v_next_org_id IS NOT NULL THEN
    UPDATE trader_users
       SET user_type     = 'org_admin',
           org_id        = v_next_org_id,
           active_org_id = v_next_org_id
     WHERE id = v_caller_id;
  ELSE
    UPDATE trader_users
       SET user_type     = 'indie',
           org_id        = NULL,
           active_org_id = NULL
     WHERE id = v_caller_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION super_admin_delete_org(uuid) TO authenticated;

# 015
-- ================================================================
-- 015_fix_delete_org_fk.sql
--
-- Fixes: "update or delete on table organisations violates
-- foreign key constraint trader_users_org_id_fkey"
--
-- Root cause: trader_users.org_id has a FK → organisations.id.
-- The previous fix excluded super admins from the member reset,
-- so the super admin's org_id still pointed at the org being
-- deleted when DELETE FROM organisations ran.
--
-- Fix: null out org_id on ALL members (including super admin)
-- before deleting the org row. Super admin's user_type and
-- active_org_id are then corrected in the restore step below.
-- ================================================================

CREATE OR REPLACE FUNCTION super_admin_delete_org(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id    uuid;
  v_caller_role  text;
  v_my_org_role  text;
  v_next_org_id  uuid;
BEGIN
  SELECT tu.id, tu.role
    INTO v_caller_id, v_caller_role
    FROM trader_users tu
   WHERE tu.auth_user_id = auth.uid()
   LIMIT 1;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorised');
  END IF;

  SELECT org_role INTO v_my_org_role
    FROM org_memberships
   WHERE user_id = v_caller_id AND org_id = p_org_id;

  IF v_my_org_role IS DISTINCT FROM 'owner' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You are not the owner of this organisation');
  END IF;

  -- Step 1: null out org_id on ALL members (satisfies the FK)
  -- and reset non-super-admins to indie at the same time.
  -- Super admin is included here just to clear the FK reference —
  -- their user_type is corrected in the restore step below.
  UPDATE trader_users
     SET org_id    = NULL,
         user_type = CASE WHEN role = 'admin' THEN user_type ELSE 'indie' END
   WHERE id IN (
     SELECT user_id FROM org_memberships WHERE org_id = p_org_id
   );

  -- Step 2: cascade deletes — org_id FK is now clear
  DELETE FROM org_group_members
   WHERE group_id IN (SELECT id FROM org_groups WHERE org_id = p_org_id);
  DELETE FROM org_groups      WHERE org_id = p_org_id;
  DELETE FROM org_memberships WHERE org_id = p_org_id;
  DELETE FROM org_invites     WHERE org_id = p_org_id;
  DELETE FROM organisations   WHERE id     = p_org_id;

  -- Step 3: restore caller to their next org, or indie
  SELECT org_id INTO v_next_org_id
    FROM org_memberships
   WHERE user_id = v_caller_id
   ORDER BY joined_at ASC
   LIMIT 1;

  IF v_next_org_id IS NOT NULL THEN
    UPDATE trader_users
       SET user_type     = 'org_admin',
           org_id        = v_next_org_id,
           active_org_id = v_next_org_id
     WHERE id = v_caller_id;
  ELSE
    UPDATE trader_users
       SET user_type     = 'indie',
           org_id        = NULL,
           active_org_id = NULL
     WHERE id = v_caller_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION super_admin_delete_org(uuid) TO authenticated;

# 016
-- ================================================================
-- 016_missing_rpcs_snapshot.sql
--
-- Captures RPCs that exist in production but were created before
-- migration tracking began (migrations 001–006) and were never
-- recorded in dbfiles.md.
--
-- Safe to re-run: all statements use CREATE OR REPLACE.
-- Does NOT change any schema or data.
-- ================================================================


-- ── Helper: resolve auth.uid() → trader_users.id ─────────────
CREATE OR REPLACE FUNCTION auth_trader_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM trader_users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

ALTER FUNCTION auth_trader_id() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION auth_trader_id() TO authenticated;


-- ── promote_member ────────────────────────────────────────────
-- Promotes or demotes a member within an org.
-- Blocks self-promotion and non-owner ownership transfers.
CREATE OR REPLACE FUNCTION promote_member(
  p_member_id uuid,
  p_org_id    uuid,
  p_new_role  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_caller_id   uuid;
  v_caller_role text;
begin
  select id into v_caller_id from trader_users where auth_user_id = auth.uid();

  if v_caller_id = p_member_id then
    return jsonb_build_object('ok', false, 'error', 'Cannot change your own role');
  end if;

  select org_role into v_caller_role
  from org_memberships where user_id = v_caller_id and org_id = p_org_id;

  if v_caller_role not in ('owner','admin') then
    return jsonb_build_object('ok', false, 'error', 'Insufficient permissions');
  end if;

  if p_new_role = 'owner' and v_caller_role != 'owner' then
    return jsonb_build_object('ok', false, 'error', 'Only the owner can transfer ownership');
  end if;

  update org_memberships
  set org_role = p_new_role
  where user_id = p_member_id and org_id = p_org_id;

  update trader_users
  set
    org_role  = p_new_role,
    user_type = case when p_new_role in ('owner','admin') then 'org_admin' else 'org_member' end
  where id = p_member_id;

  return jsonb_build_object('ok', true);
end;
$$;

ALTER FUNCTION promote_member(uuid, uuid, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION promote_member(uuid, uuid, text) TO authenticated;


-- ── remove_member ─────────────────────────────────────────────
-- Removes a member from an org. If they have no remaining
-- memberships, resets them to indie.
CREATE OR REPLACE FUNCTION remove_member(
  p_member_id uuid,
  p_org_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_caller_id   uuid;
  v_caller_role text;
  v_remaining   int;
begin
  select id into v_caller_id from trader_users where auth_user_id = auth.uid();

  if v_caller_id = p_member_id then
    return jsonb_build_object('ok', false, 'error', 'Cannot remove yourself');
  end if;

  select org_role into v_caller_role
  from org_memberships where user_id = v_caller_id and org_id = p_org_id;

  if v_caller_role not in ('owner','admin') then
    return jsonb_build_object('ok', false, 'error', 'Insufficient permissions');
  end if;

  delete from org_memberships where user_id = p_member_id and org_id = p_org_id;

  select count(*) into v_remaining
  from org_memberships where user_id = p_member_id;

  if v_remaining = 0 then
    update trader_users
    set user_type = 'indie', org_id = null, org_role = null
    where id = p_member_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

ALTER FUNCTION remove_member(uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION remove_member(uuid, uuid) TO authenticated;


-- ── update_own_trade ──────────────────────────────────────────
-- Lets a user edit allowed fields on their own trade.
-- Every changed field is written to trade_audit_log.
CREATE OR REPLACE FUNCTION update_own_trade(
  p_trade_id  uuid,
  p_quantity  numeric DEFAULT NULL,
  p_stop_loss numeric DEFAULT NULL,
  p_target    numeric DEFAULT NULL,
  p_notes     text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_user_id uuid;
  v_trade   trades%rowtype;
begin
  select id into v_user_id from trader_users where auth_user_id = auth.uid();

  select * into v_trade from trades
  where id = p_trade_id and user_id = v_user_id and deleted_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Trade not found or access denied');
  end if;

  update trades set
    quantity  = coalesce(p_quantity,  quantity),
    stop_loss = coalesce(p_stop_loss, stop_loss),
    target    = coalesce(p_target,    target),
    notes     = coalesce(p_notes,     notes)
  where id = p_trade_id;

  if p_quantity  is not null and p_quantity  is distinct from v_trade.quantity then
    insert into trade_audit_log (trade_id,acted_by,action,field_name,old_value,new_value)
    values (p_trade_id,v_user_id,'edit_quantity','quantity',
            v_trade.quantity::text, p_quantity::text);
  end if;
  if p_stop_loss is not null and p_stop_loss is distinct from v_trade.stop_loss then
    insert into trade_audit_log (trade_id,acted_by,action,field_name,old_value,new_value)
    values (p_trade_id,v_user_id,'edit_stop_loss','stop_loss',
            v_trade.stop_loss::text, p_stop_loss::text);
  end if;
  if p_target is not null and p_target is distinct from v_trade.target then
    insert into trade_audit_log (trade_id,acted_by,action,field_name,old_value,new_value)
    values (p_trade_id,v_user_id,'edit_target','target',
            v_trade.target::text, p_target::text);
  end if;
  if p_notes is not null and p_notes is distinct from v_trade.notes then
    insert into trade_audit_log (trade_id,acted_by,action,field_name,old_value,new_value)
    values (p_trade_id,v_user_id,'edit_notes','notes', v_trade.notes, p_notes);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

ALTER FUNCTION update_own_trade(uuid, numeric, numeric, numeric, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION update_own_trade(uuid, numeric, numeric, numeric, text) TO authenticated;


-- ── admin_soft_delete_trade ───────────────────────────────────
-- Admin soft-deletes a trade in their org. Requires a reason.
-- Sets deleted_at/deleted_by/delete_reason and writes audit log.
CREATE OR REPLACE FUNCTION admin_soft_delete_trade(
  p_trade_id uuid,
  p_org_id   uuid,
  p_reason   text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_caller_id   uuid;
  v_caller_role text;
  v_trade       trades%rowtype;
begin
  if p_reason is null or trim(p_reason) = '' then
    return jsonb_build_object('ok', false, 'error', 'A reason is required');
  end if;

  select id into v_caller_id from trader_users where auth_user_id = auth.uid();

  select org_role into v_caller_role
  from org_memberships where user_id = v_caller_id and org_id = p_org_id;

  if v_caller_role not in ('owner','admin') then
    return jsonb_build_object('ok', false, 'error', 'Insufficient permissions');
  end if;

  select t.* into v_trade
  from trades t
  join org_memberships om on om.user_id = t.user_id
  where t.id = p_trade_id and om.org_id = p_org_id and t.deleted_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Trade not found in your organisation');
  end if;

  update trades
  set deleted_at = now(), deleted_by = v_caller_id, delete_reason = p_reason
  where id = p_trade_id;

  insert into trade_audit_log (trade_id, acted_by, action, reason)
  values (p_trade_id, v_caller_id, 'soft_delete', p_reason);

  return jsonb_build_object('ok', true);
end;
$$;

ALTER FUNCTION admin_soft_delete_trade(uuid, uuid, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION admin_soft_delete_trade(uuid, uuid, text) TO authenticated;


-- ── rename_organisation ───────────────────────────────────────
-- Owner or admin renames their org.
CREATE OR REPLACE FUNCTION rename_organisation(
  p_org_id   uuid,
  p_new_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_caller_id   uuid;
  v_caller_role text;
begin
  if p_new_name is null or trim(p_new_name) = '' then
    return jsonb_build_object('ok', false, 'error', 'Name cannot be empty');
  end if;

  select id into v_caller_id
  from trader_users where auth_user_id = auth.uid();

  select org_role into v_caller_role
  from org_memberships
  where user_id = v_caller_id and org_id = p_org_id;

  if v_caller_role not in ('owner','admin') then
    return jsonb_build_object('ok', false, 'error', 'Insufficient permissions');
  end if;

  update organisations
  set name = trim(p_new_name)
  where id = p_org_id;

  return jsonb_build_object('ok', true);
end;
$$;

ALTER FUNCTION rename_organisation(uuid, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION rename_organisation(uuid, text) TO authenticated;


-- ── delete_organisation ───────────────────────────────────────
-- Owner-only hard delete. Resets all members to indie, then
-- cascades org_memberships and org_invites via FK.
-- NOTE: superseded by super_admin_delete_org for super admins.
-- Regular org owners (non-super-admin) still use this RPC.
CREATE OR REPLACE FUNCTION delete_organisation(
  p_org_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_caller_id   uuid;
  v_caller_role text;
begin
  select id into v_caller_id
  from trader_users where auth_user_id = auth.uid();

  if v_caller_id is null then
    return jsonb_build_object('ok', false, 'error', 'User not found');
  end if;

  select org_role into v_caller_role
  from org_memberships
  where user_id = v_caller_id and org_id = p_org_id;

  if v_caller_role != 'owner' then
    return jsonb_build_object('ok', false, 'error', 'Only the organisation owner can delete it');
  end if;

  -- Reset all members to indie
  update trader_users
  set user_type = 'indie', org_id = null, org_role = null
  where id in (
    select user_id from org_memberships where org_id = p_org_id
  );

  -- org_memberships and org_invites cascade via FK on organisations
  delete from organisations where id = p_org_id;

  return jsonb_build_object('ok', true);
end;
$$;

ALTER FUNCTION delete_organisation(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION delete_organisation(uuid) TO authenticated;


-- ── set_user_capital_limit ────────────────────────────────────
-- NOTE: This RPC was referenced in setup.md but not found in the
-- information_schema query. If it exists, it was likely created
-- outside the tracked migrations. Check with:
--   SELECT routine_name FROM information_schema.routines
--   WHERE routine_name = 'set_user_capital_limit';
-- If missing, create it:
CREATE OR REPLACE FUNCTION set_user_capital_limit(
  p_member_id    uuid,
  p_org_id       uuid,
  p_capital_limit numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_caller_id   uuid;
  v_caller_role text;
begin
  select id into v_caller_id from trader_users where auth_user_id = auth.uid();

  select org_role into v_caller_role
  from org_memberships where user_id = v_caller_id and org_id = p_org_id;

  if v_caller_role not in ('owner', 'admin') then
    return jsonb_build_object('ok', false, 'error', 'Insufficient permissions');
  end if;

  -- Verify target is a member of this org
  if not exists (
    select 1 from org_memberships where user_id = p_member_id and org_id = p_org_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'User is not a member of this organisation');
  end if;

  update trader_users
  set capital_limit = p_capital_limit
  where id = p_member_id;

  return jsonb_build_object('ok', true);
end;
$$;

ALTER FUNCTION set_user_capital_limit(uuid, uuid, numeric) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION set_user_capital_limit(uuid, uuid, numeric) TO authenticated;
