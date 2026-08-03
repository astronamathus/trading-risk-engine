-- Super Admin org creation patch 

create or replace function public.super_admin_create_org(
  p_name     text,
  p_domain   text default null,
  p_currency text default 'INR'
)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return create_org_with_owner(p_name, p_domain, p_currency);
end;$$;

alter function public.super_admin_create_org(text,text,text) owner to postgres;
grant execute on function public.super_admin_create_org(text,text,text) to authenticated;

notify pgrst, 'reload schema';





-- ================================================================
-- 000_full_setup.sql
-- Trading Risk Engine — complete database setup from scratch.
-- Run this once on a fresh Supabase project.
-- ================================================================


-- ================================================================
-- 1. TABLES
-- ================================================================

create table if not exists trader_users (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid references auth.users(id),
  anonymous_id  text,
  display_name  text,
  avatar_url    text,
  user_type     text,
  org_id        uuid,          -- legacy, FK added below after organisations exists
  org_role      text,          -- legacy
  role          text not null default 'user',
  capital_limit numeric not null default 100000,
  currency      text not null default 'INR' check (currency in ('INR','USD')),
  active_org_id uuid,          -- FK added below
  created_at    timestamptz not null default now()
);

create table if not exists organisations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  domain     text,
  currency   text not null default 'INR' check (currency in ('INR','USD')),
  created_at timestamptz not null default now()
);

-- Add FKs now that both tables exist
alter table trader_users
  add column if not exists org_id uuid references organisations(id) on delete set null;
alter table trader_users
  add column if not exists active_org_id uuid references organisations(id) on delete set null;

create table if not exists org_memberships (
  org_id         uuid not null references organisations(id) on delete cascade,
  user_id        uuid not null references trader_users(id),
  org_role       text not null default 'member',
  on_leaderboard boolean not null default true,
  joined_at      timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table if not exists org_invites (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organisations(id) on delete cascade,
  code       text not null unique,
  role       text default 'member',
  expires_at timestamptz not null,
  max_uses   int,
  use_count  int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists trades (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references trader_users(id),
  ticker        text not null,
  quantity      numeric not null,
  entry_price   numeric not null,
  stop_loss     numeric not null,
  target        numeric,
  entry_target  numeric,
  exit_price    numeric,
  risk_amount   numeric,
  realised_pnl  numeric,
  capital       numeric,
  status        text not null default 'QUEUED',
  notes         text,
  deleted_at    timestamptz,
  deleted_by    uuid references trader_users(id),
  delete_reason text,
  created_at    timestamptz not null default now()
);

create table if not exists trade_audit_log (
  id         uuid primary key default gen_random_uuid(),
  trade_id   uuid not null references trades(id),
  acted_by   uuid references trader_users(id),
  action     text not null check (action = any (array[
    'edit_quantity','edit_stop_loss','edit_target','edit_notes',
    'edit_status','edit_exit_price','soft_delete','restore',
    'admin_edit','admin_close'
  ])),
  field_name text,
  old_value  text,
  new_value  text,
  reason     text,
  created_at timestamptz not null default now()
);

create table if not exists org_groups (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organisations(id) on delete cascade,
  name       text not null,
  created_by uuid references trader_users(id),
  created_at timestamptz not null default now()
);

create table if not exists org_group_members (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references org_groups(id) on delete cascade,
  user_id   uuid not null references trader_users(id) on delete cascade,
  org_id    uuid not null references organisations(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (user_id, org_id)
);


-- ================================================================
-- 2. INDEXES
-- ================================================================

create index if not exists idx_trades_user_id      on trades(user_id);
create index if not exists idx_trades_user_active  on trades(user_id, deleted_at) where deleted_at is null;
create index if not exists idx_trades_user_status  on trades(user_id, status);
create index if not exists org_groups_org_idx      on org_groups(org_id);
create index if not exists group_members_group_idx on org_group_members(group_id);
create index if not exists group_members_user_idx  on org_group_members(user_id);


-- ================================================================
-- 3. HELPER FUNCTION
-- ================================================================

create or replace function auth_trader_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from trader_users where auth_user_id = auth.uid() limit 1;
$$;
alter function auth_trader_id() owner to postgres;
grant execute on function auth_trader_id() to authenticated;


-- ================================================================
-- 4. SECURITY-DEFINER VIEW (used by RLS policies below)
-- ================================================================

create or replace view auth_org_roles
  with (security_invoker = false)
as
  select om.org_id, om.org_role
  from   org_memberships om
  join   trader_users    tu on tu.id = om.user_id
  where  tu.auth_user_id = auth.uid();

grant select on auth_org_roles to authenticated;


-- ================================================================
-- 5. ROW LEVEL SECURITY
-- ================================================================

-- trader_users
alter table trader_users enable row level security;

drop policy if exists "own_user_insert"        on trader_users;
drop policy if exists "own_user_read"           on trader_users;
drop policy if exists "own_user_update"         on trader_users;
drop policy if exists "org_admin_read_members"  on trader_users;

create policy "own_user_insert" on trader_users
  for insert to authenticated
  with check (auth_user_id = auth.uid());

create policy "own_user_read" on trader_users
  for select to authenticated
  using (auth_user_id = auth.uid());

create policy "own_user_update" on trader_users
  for update to authenticated
  using  (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Admins can read member rows without recursion
create policy "org_admin_read_members" on trader_users
  for select to authenticated
  using (
    exists (
      select 1
      from org_memberships caller_m
      join trader_users    caller_u on caller_u.id = caller_m.user_id
      join org_memberships target_m on target_m.org_id = caller_m.org_id
      where caller_u.auth_user_id = auth.uid()
        and caller_m.org_role in ('owner','admin')
        and target_m.user_id = trader_users.id
    )
  );

-- org_memberships
alter table org_memberships enable row level security;

drop policy if exists "own_memberships_read"       on org_memberships;
drop policy if exists "admin_read_org_memberships" on org_memberships;
drop policy if exists "no_direct_membership_write" on org_memberships;

create policy "own_memberships_read" on org_memberships
  for select to authenticated
  using (
    user_id = (select id from trader_users where auth_user_id = auth.uid() limit 1)
  );

create policy "admin_read_org_memberships" on org_memberships
  for select to authenticated
  using (
    org_id in (select org_id from auth_org_roles where org_role in ('owner','admin'))
  );

create policy "no_direct_membership_write" on org_memberships
  for all to authenticated
  using (false) with check (false);

-- organisations
alter table organisations enable row level security;

drop policy if exists "org_insert"       on organisations;
drop policy if exists "org_members_read" on organisations;
drop policy if exists "org_admin_update" on organisations;

create policy "org_insert" on organisations
  for insert to authenticated
  with check (true);

create policy "org_members_read" on organisations
  for select to authenticated
  using (id in (select org_id from auth_org_roles));

create policy "org_admin_update" on organisations
  for update to authenticated
  using (id in (select org_id from auth_org_roles where org_role in ('owner','admin')));

-- org_invites
alter table org_invites enable row level security;

drop policy if exists "admin_manage_invites" on org_invites;
drop policy if exists "read_invite_by_code"  on org_invites;

create policy "admin_manage_invites" on org_invites
  for all to authenticated
  using      (org_id in (select org_id from auth_org_roles where org_role in ('owner','admin')))
  with check (org_id in (select org_id from auth_org_roles where org_role in ('owner','admin')));

create policy "read_invite_by_code" on org_invites
  for select to authenticated
  using (true);

-- trades
alter table trades enable row level security;

drop policy if exists "own_trades_read"        on trades;
drop policy if exists "own_trades_insert"      on trades;
drop policy if exists "own_trades_update"      on trades;
drop policy if exists "admin_org_trades_read"  on trades;
drop policy if exists "admin_org_trades_update"on trades;
drop policy if exists "no_hard_delete_trades"  on trades;

create policy "own_trades_read" on trades
  for select to authenticated
  using (user_id = auth_trader_id() and deleted_at is null);

create policy "own_trades_insert" on trades
  for insert to authenticated
  with check (user_id = auth_trader_id());

create policy "own_trades_update" on trades
  for update to authenticated
  using (user_id = auth_trader_id() and deleted_at is null);

create policy "admin_org_trades_read" on trades
  for select to authenticated
  using (
    user_id in (
      select om.user_id from org_memberships om
      where om.org_id in (select org_id from auth_org_roles where org_role in ('owner','admin'))
    )
  );

create policy "admin_org_trades_update" on trades
  for update to authenticated
  using (
    user_id in (
      select om.user_id from org_memberships om
      where om.org_id in (select org_id from auth_org_roles where org_role in ('owner','admin'))
    )
  );

create policy "no_hard_delete_trades" on trades
  for delete to authenticated
  using (false);

-- trade_audit_log
alter table trade_audit_log enable row level security;

drop policy if exists "own_trade_audit_read"  on trade_audit_log;
drop policy if exists "admin_audit_read"       on trade_audit_log;
drop policy if exists "no_direct_audit_write"  on trade_audit_log;

create policy "own_trade_audit_read" on trade_audit_log
  for select to authenticated
  using (trade_id in (select id from trades where user_id = auth_trader_id()));

create policy "admin_audit_read" on trade_audit_log
  for select to authenticated
  using (
    trade_id in (
      select t.id from trades t
      join org_memberships om on om.user_id = t.user_id
      where om.org_id in (select org_id from auth_org_roles where org_role in ('owner','admin'))
    )
  );

create policy "no_direct_audit_write" on trade_audit_log
  for all to authenticated
  using (false) with check (false);

-- org_groups and org_group_members: no RLS, mutations go through security-definer RPCs
grant select,insert,update,delete on public.org_groups        to authenticated;
grant select,insert,update,delete on public.org_group_members to authenticated;


-- ================================================================
-- 6. CORE RPCs
-- ================================================================

-- promote_member
create or replace function promote_member(
  p_member_id uuid, p_org_id uuid, p_new_role text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text;
begin
  select id into v_caller_id from trader_users where auth_user_id = auth.uid();
  if v_caller_id = p_member_id then
    return jsonb_build_object('ok',false,'error','Cannot change your own role');
  end if;
  select org_role into v_caller_role from org_memberships
  where user_id = v_caller_id and org_id = p_org_id;
  if v_caller_role not in ('owner','admin') then
    return jsonb_build_object('ok',false,'error','Insufficient permissions');
  end if;
  if p_new_role = 'owner' and v_caller_role != 'owner' then
    return jsonb_build_object('ok',false,'error','Only the owner can transfer ownership');
  end if;
  update org_memberships set org_role = p_new_role
  where user_id = p_member_id and org_id = p_org_id;
  update trader_users set
    org_role  = p_new_role,
    user_type = case when p_new_role in ('owner','admin') then 'org_admin' else 'org_member' end
  where id = p_member_id;
  return jsonb_build_object('ok',true);
end;$$;
alter function promote_member(uuid,uuid,text) owner to postgres;
grant execute on function promote_member(uuid,uuid,text) to authenticated;

-- remove_member
create or replace function remove_member(p_member_id uuid, p_org_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text; v_remaining int;
begin
  select id into v_caller_id from trader_users where auth_user_id = auth.uid();
  if v_caller_id = p_member_id then
    return jsonb_build_object('ok',false,'error','Cannot remove yourself');
  end if;
  select org_role into v_caller_role from org_memberships
  where user_id = v_caller_id and org_id = p_org_id;
  if v_caller_role not in ('owner','admin') then
    return jsonb_build_object('ok',false,'error','Insufficient permissions');
  end if;
  delete from org_memberships where user_id = p_member_id and org_id = p_org_id;
  select count(*) into v_remaining from org_memberships where user_id = p_member_id;
  if v_remaining = 0 then
    update trader_users set user_type = 'indie', org_id = null, org_role = null
    where id = p_member_id;
  end if;
  return jsonb_build_object('ok',true);
end;$$;
alter function remove_member(uuid,uuid) owner to postgres;
grant execute on function remove_member(uuid,uuid) to authenticated;

-- update_own_trade
create or replace function update_own_trade(
  p_trade_id  uuid,
  p_quantity  numeric default null,
  p_stop_loss numeric default null,
  p_target    numeric default null,
  p_notes     text    default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user_id uuid; v_trade trades%rowtype;
begin
  select id into v_user_id from trader_users where auth_user_id = auth.uid();
  select * into v_trade from trades
  where id = p_trade_id and user_id = v_user_id and deleted_at is null;
  if not found then
    return jsonb_build_object('ok',false,'error','Trade not found or access denied');
  end if;
  update trades set
    quantity  = coalesce(p_quantity,  quantity),
    stop_loss = coalesce(p_stop_loss, stop_loss),
    target    = coalesce(p_target,    target),
    notes     = coalesce(p_notes,     notes)
  where id = p_trade_id;
  if p_quantity  is not null and p_quantity  is distinct from v_trade.quantity then
    insert into trade_audit_log (trade_id,acted_by,action,field_name,old_value,new_value)
    values (p_trade_id,v_user_id,'edit_quantity','quantity',v_trade.quantity::text,p_quantity::text);
  end if;
  if p_stop_loss is not null and p_stop_loss is distinct from v_trade.stop_loss then
    insert into trade_audit_log (trade_id,acted_by,action,field_name,old_value,new_value)
    values (p_trade_id,v_user_id,'edit_stop_loss','stop_loss',v_trade.stop_loss::text,p_stop_loss::text);
  end if;
  if p_target is not null and p_target is distinct from v_trade.target then
    insert into trade_audit_log (trade_id,acted_by,action,field_name,old_value,new_value)
    values (p_trade_id,v_user_id,'edit_target','target',v_trade.target::text,p_target::text);
  end if;
  if p_notes is not null and p_notes is distinct from v_trade.notes then
    insert into trade_audit_log (trade_id,acted_by,action,field_name,old_value,new_value)
    values (p_trade_id,v_user_id,'edit_notes','notes',v_trade.notes,p_notes);
  end if;
  return jsonb_build_object('ok',true);
end;$$;
alter function update_own_trade(uuid,numeric,numeric,numeric,text) owner to postgres;
grant execute on function update_own_trade(uuid,numeric,numeric,numeric,text) to authenticated;

-- admin_soft_delete_trade
create or replace function admin_soft_delete_trade(
  p_trade_id uuid, p_org_id uuid, p_reason text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text; v_trade trades%rowtype;
begin
  if p_reason is null or trim(p_reason) = '' then
    return jsonb_build_object('ok',false,'error','A reason is required');
  end if;
  select id into v_caller_id from trader_users where auth_user_id = auth.uid();
  select org_role into v_caller_role from org_memberships
  where user_id = v_caller_id and org_id = p_org_id;
  if v_caller_role not in ('owner','admin') then
    return jsonb_build_object('ok',false,'error','Insufficient permissions');
  end if;
  select t.* into v_trade from trades t
  join org_memberships om on om.user_id = t.user_id
  where t.id = p_trade_id and om.org_id = p_org_id and t.deleted_at is null;
  if not found then
    return jsonb_build_object('ok',false,'error','Trade not found in your organisation');
  end if;
  update trades set deleted_at = now(), deleted_by = v_caller_id, delete_reason = p_reason
  where id = p_trade_id;
  insert into trade_audit_log (trade_id,acted_by,action,reason)
  values (p_trade_id,v_caller_id,'soft_delete',p_reason);
  return jsonb_build_object('ok',true);
end;$$;
alter function admin_soft_delete_trade(uuid,uuid,text) owner to postgres;
grant execute on function admin_soft_delete_trade(uuid,uuid,text) to authenticated;

-- set_user_capital_limit
create or replace function set_user_capital_limit(
  p_member_id     uuid,
  p_org_id        uuid,
  p_capital_limit numeric
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text;
begin
  select id into v_caller_id from trader_users where auth_user_id = auth.uid();
  select org_role into v_caller_role from org_memberships
  where user_id = v_caller_id and org_id = p_org_id;
  if v_caller_role not in ('owner','admin') then
    return jsonb_build_object('ok',false,'error','Insufficient permissions');
  end if;
  if not exists (
    select 1 from org_memberships where user_id = p_member_id and org_id = p_org_id
  ) then
    return jsonb_build_object('ok',false,'error','User is not a member of this organisation');
  end if;
  update trader_users set capital_limit = p_capital_limit where id = p_member_id;
  return jsonb_build_object('ok',true);
end;$$;
alter function set_user_capital_limit(uuid,uuid,numeric) owner to postgres;
grant execute on function set_user_capital_limit(uuid,uuid,numeric) to authenticated;

-- rename_organisation
create or replace function rename_organisation(p_org_id uuid, p_new_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text;
begin
  if p_new_name is null or trim(p_new_name) = '' then
    return jsonb_build_object('ok',false,'error','Name cannot be empty');
  end if;
  select id into v_caller_id from trader_users where auth_user_id = auth.uid();
  select org_role into v_caller_role from org_memberships
  where user_id = v_caller_id and org_id = p_org_id;
  if v_caller_role not in ('owner','admin') then
    return jsonb_build_object('ok',false,'error','Insufficient permissions');
  end if;
  update organisations set name = trim(p_new_name) where id = p_org_id;
  return jsonb_build_object('ok',true);
end;$$;
alter function rename_organisation(uuid,text) owner to postgres;
grant execute on function rename_organisation(uuid,text) to authenticated;

-- delete_organisation (non-super-admin path)
create or replace function delete_organisation(p_org_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text;
begin
  select id into v_caller_id from trader_users where auth_user_id = auth.uid();
  if v_caller_id is null then
    return jsonb_build_object('ok',false,'error','User not found');
  end if;
  select org_role into v_caller_role from org_memberships
  where user_id = v_caller_id and org_id = p_org_id;
  if v_caller_role != 'owner' then
    return jsonb_build_object('ok',false,'error','Only the organisation owner can delete it');
  end if;
  update trader_users set user_type = 'indie', org_id = null, org_role = null
  where id in (select user_id from org_memberships where org_id = p_org_id);
  delete from organisations where id = p_org_id;
  return jsonb_build_object('ok',true);
end;$$;
alter function delete_organisation(uuid) owner to postgres;
grant execute on function delete_organisation(uuid) to authenticated;

-- create_org_with_owner
create or replace function create_org_with_owner(
  p_name     text,
  p_domain   text default null,
  p_currency text default 'INR'
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_caller_id   uuid;
  v_caller_role text;
  v_org_id      uuid;
  v_slug        text;
begin
  select tu.id, tu.role into v_caller_id, v_caller_role
  from trader_users tu where tu.auth_user_id = auth.uid() limit 1;
  if v_caller_id is null then
    return jsonb_build_object('ok',false,'error','Not authenticated');
  end if;
  if v_caller_role != 'admin' and exists (
    select 1 from org_memberships where user_id = v_caller_id
  ) then
    return jsonb_build_object('ok',false,'error','Already a member of an organisation');
  end if;
  v_slug   := lower(regexp_replace(trim(p_name), '[^a-z0-9]+', '-', 'g'));
  v_org_id := gen_random_uuid();
  insert into organisations (id, name, slug, domain, currency)
  values (v_org_id, p_name, v_slug, p_domain, p_currency);
  insert into org_memberships (user_id, org_id, org_role, joined_at)
  values (v_caller_id, v_org_id, 'owner', now())
  on conflict (org_id, user_id) do nothing;
  if v_caller_role = 'admin' then
    update trader_users set active_org_id = v_org_id where id = v_caller_id;
  else
    update trader_users set
      user_type = 'org_admin', org_id = v_org_id, org_role = 'owner', active_org_id = v_org_id
    where id = v_caller_id;
  end if;
  return jsonb_build_object('ok',true,'org_id',v_org_id);
end;$$;
alter function create_org_with_owner(text,text,text) owner to postgres;
grant execute on function create_org_with_owner(text,text,text) to authenticated;

-- validate_and_accept_invite
create or replace function validate_and_accept_invite(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_invite  org_invites%rowtype;
  v_org     organisations%rowtype;
  v_user_id uuid;
  v_email   text;
  v_role    text;
begin
  select id into v_user_id from trader_users where auth_user_id = auth.uid();
  if v_user_id is null then
    return jsonb_build_object('ok',false,'error','User not found');
  end if;
  select email into v_email from auth.users where id = auth.uid();
  select * into v_invite from org_invites where code = p_code;
  if not found then return jsonb_build_object('ok',false,'error','Invite not found'); end if;
  if v_invite.expires_at < now() then return jsonb_build_object('ok',false,'error','Invite has expired'); end if;
  if v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then
    return jsonb_build_object('ok',false,'error','Invite has reached its usage limit');
  end if;
  if exists (select 1 from org_memberships where user_id = v_user_id and org_id = v_invite.org_id) then
    return jsonb_build_object('ok',false,'error','You are already a member of this organisation');
  end if;
  select * into v_org from organisations where id = v_invite.org_id;
  if v_org.domain is not null then
    if v_email not ilike '%@' || v_org.domain then
      return jsonb_build_object('ok',false,'error','Your email domain is not allowed for this organisation');
    end if;
  end if;
  v_role := coalesce(v_invite.role,'member');
  insert into org_memberships (user_id, org_id, org_role)
  values (v_user_id, v_invite.org_id, v_role);
  update trader_users set
    user_type = case when v_role = 'admin' then 'org_admin' else 'org_member' end,
    org_id    = v_invite.org_id,
    org_role  = v_role,
    currency  = v_org.currency
  where id = v_user_id;
  update org_invites set use_count = use_count + 1 where id = v_invite.id;
  return jsonb_build_object('ok',true,'org_id',v_invite.org_id,'role',v_role,'currency',v_org.currency);
end;$$;
alter function validate_and_accept_invite(text) owner to postgres;
grant execute on function validate_and_accept_invite(text) to authenticated;

-- toggle_leaderboard_visibility
create or replace function toggle_leaderboard_visibility(p_org_id uuid, p_show boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user_id uuid;
begin
  select id into v_user_id from trader_users where auth_user_id = auth.uid();
  if v_user_id is null then return jsonb_build_object('ok',false,'error','User not found'); end if;
  update org_memberships set on_leaderboard = p_show
  where user_id = v_user_id and org_id = p_org_id;
  return jsonb_build_object('ok',true);
end;$$;
alter function toggle_leaderboard_visibility(uuid,boolean) owner to postgres;
grant execute on function toggle_leaderboard_visibility(uuid,boolean) to authenticated;


-- ================================================================
-- 7. LEADERBOARD RPCs
-- ================================================================

create or replace function get_org_leaderboard(p_org_id uuid, p_sort text default 'lifetime_pnl')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_caller_id   uuid; v_caller_role text; v_is_admin bool;
  v_month_start timestamptz; v_on_lb bool; v_result jsonb;
begin
  select id into v_caller_id from trader_users where auth_user_id = auth.uid();
  select org_role, on_leaderboard into v_caller_role, v_on_lb
  from org_memberships where user_id = v_caller_id and org_id = p_org_id;
  if not found then return jsonb_build_object('ok',false,'error','Not a member of this organisation'); end if;
  v_is_admin    := v_caller_role in ('owner','admin');
  v_month_start := date_trunc('month', now());
  if p_sort not in ('lifetime_pnl','monthly_pnl','win_rate','avg_r') then p_sort := 'lifetime_pnl'; end if;
  with stats as (
    select
      tu.id as user_id, tu.display_name, tu.avatar_url,
      (tu.id = v_caller_id) as is_current_user, om.org_role, om.on_leaderboard,
      count(*) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT'))::int as total_closed,
      count(*) filter (where t.status = 'OPEN')::int as open_trades,
      coalesce(sum(t.realised_pnl) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT')),0) as lifetime_pnl,
      coalesce(sum(t.realised_pnl) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT') and t.created_at >= v_month_start),0) as monthly_pnl,
      case when count(*) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT')) = 0 then null
        else round(100.0 * count(*) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT') and coalesce(t.realised_pnl,0) > 0)::numeric
          / count(*) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT')), 2) end as win_rate,
      case when count(*) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT') and coalesce(t.risk_amount,0) > 0) = 0 then null
        else round(avg(t.realised_pnl / nullif(t.risk_amount,0)) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT') and coalesce(t.risk_amount,0) > 0), 3) end as avg_r
    from org_memberships om
    join trader_users tu on tu.id = om.user_id
    left join trades t on t.user_id = tu.id and t.deleted_at is null
    where om.org_id = p_org_id and (om.on_leaderboard = true or tu.id = v_caller_id)
    group by tu.id, tu.display_name, tu.avatar_url, om.org_role, om.on_leaderboard
  ),
  ranked as (
    select *, row_number() over (order by case p_sort
      when 'lifetime_pnl' then lifetime_pnl when 'monthly_pnl' then monthly_pnl
      when 'win_rate' then coalesce(win_rate,-1) when 'avg_r' then coalesce(avg_r,-999)
    end desc) as rank from stats
  )
  select jsonb_build_object('ok',true,'is_admin',v_is_admin,'i_am_on_lb',v_on_lb,
    'rows', jsonb_agg(
      case when v_is_admin then
        jsonb_build_object('rank',rank,'user_id',user_id,'display_name',display_name,
          'avatar_url',avatar_url,'is_current_user',is_current_user,'on_leaderboard',on_leaderboard,
          'total_closed',total_closed,'open_trades',open_trades,'lifetime_pnl',lifetime_pnl,
          'monthly_pnl',monthly_pnl,'win_rate',win_rate,'avg_r',avg_r)
      else
        jsonb_build_object('rank',rank,'user_id',user_id,'display_name',display_name,
          'avatar_url',avatar_url,'is_current_user',is_current_user,'on_leaderboard',on_leaderboard,
          'total_closed',total_closed,'open_trades',open_trades)
      end order by rank
    )
  ) into v_result from ranked;
  return v_result;
end;$$;
alter function get_org_leaderboard(uuid,text) owner to postgres;
grant execute on function get_org_leaderboard(uuid,text) to authenticated;

-- get_org_members_with_profiles (super admins hidden)
create or replace function get_org_members_with_profiles(p_org_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text;
begin
  select tu.id, tu.role into v_caller_id, v_caller_role
  from trader_users tu where tu.auth_user_id = auth.uid() limit 1;
  if not exists (select 1 from org_memberships where user_id = v_caller_id and org_id = p_org_id) then
    return jsonb_build_object('ok',false,'error','Not authorised');
  end if;
  return jsonb_build_object(
    'ok', true,
    'is_admin', (select org_role in ('owner','admin') from org_memberships where user_id = v_caller_id and org_id = p_org_id),
    'members', (
      select jsonb_agg(jsonb_build_object(
        'id', tu.id, 'display_name', tu.display_name, 'avatar_url', tu.avatar_url,
        'org_role', om.org_role, 'capital_limit', coalesce(tu.capital_limit, 100000), 'joined_at', om.joined_at
      ) order by om.joined_at)
      from org_memberships om
      join trader_users tu on tu.id = om.user_id
      where om.org_id = p_org_id and tu.role != 'admin'
    )
  );
end;$$;
alter function get_org_members_with_profiles(uuid) owner to postgres;
grant execute on function get_org_members_with_profiles(uuid) to authenticated;


-- ================================================================
-- 8. GROUP RPCs
-- ================================================================

create or replace function create_group(p_org_id uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text; v_group_id uuid;
begin
  if p_name is null or trim(p_name) = '' then return jsonb_build_object('ok',false,'error','Group name cannot be empty'); end if;
  select id into v_caller_id from trader_users where auth_user_id = auth.uid();
  select org_role into v_caller_role from org_memberships where user_id = v_caller_id and org_id = p_org_id;
  if v_caller_role not in ('owner','admin') then return jsonb_build_object('ok',false,'error','Insufficient permissions'); end if;
  insert into org_groups (org_id,name,created_by) values (p_org_id,trim(p_name),v_caller_id) returning id into v_group_id;
  return jsonb_build_object('ok',true,'group_id',v_group_id);
end;$$;

create or replace function rename_group(p_group_id uuid, p_new_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text; v_org_id uuid;
begin
  if p_new_name is null or trim(p_new_name) = '' then return jsonb_build_object('ok',false,'error','Name cannot be empty'); end if;
  select id into v_caller_id from trader_users where auth_user_id = auth.uid();
  select org_id into v_org_id from org_groups where id = p_group_id;
  select org_role into v_caller_role from org_memberships where user_id = v_caller_id and org_id = v_org_id;
  if v_caller_role not in ('owner','admin') then return jsonb_build_object('ok',false,'error','Insufficient permissions'); end if;
  update org_groups set name = trim(p_new_name) where id = p_group_id;
  return jsonb_build_object('ok',true);
end;$$;

create or replace function delete_group(p_group_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text; v_org_id uuid;
begin
  select id into v_caller_id from trader_users where auth_user_id = auth.uid();
  select org_id into v_org_id from org_groups where id = p_group_id;
  select org_role into v_caller_role from org_memberships where user_id = v_caller_id and org_id = v_org_id;
  if v_caller_role not in ('owner','admin') then return jsonb_build_object('ok',false,'error','Insufficient permissions'); end if;
  delete from org_groups where id = p_group_id;
  return jsonb_build_object('ok',true);
end;$$;

create or replace function set_group_member(p_group_id uuid, p_member_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text; v_org_id uuid;
begin
  select id into v_caller_id from trader_users where auth_user_id = auth.uid();
  select org_id into v_org_id from org_groups where id = p_group_id;
  select org_role into v_caller_role from org_memberships where user_id = v_caller_id and org_id = v_org_id;
  if v_caller_role not in ('owner','admin') then return jsonb_build_object('ok',false,'error','Insufficient permissions'); end if;
  if not exists (select 1 from org_memberships where user_id = p_member_id and org_id = v_org_id) then
    return jsonb_build_object('ok',false,'error','User is not a member of this organisation');
  end if;
  insert into org_group_members (group_id,user_id,org_id) values (p_group_id,p_member_id,v_org_id)
  on conflict (user_id,org_id) do update set group_id = p_group_id, joined_at = now();
  return jsonb_build_object('ok',true);
end;$$;

create or replace function remove_group_member(p_group_id uuid, p_member_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text; v_org_id uuid;
begin
  select id into v_caller_id from trader_users where auth_user_id = auth.uid();
  select org_id into v_org_id from org_groups where id = p_group_id;
  select org_role into v_caller_role from org_memberships where user_id = v_caller_id and org_id = v_org_id;
  if v_caller_role not in ('owner','admin') then return jsonb_build_object('ok',false,'error','Insufficient permissions'); end if;
  delete from org_group_members where group_id = p_group_id and user_id = p_member_id;
  return jsonb_build_object('ok',true);
end;$$;

create or replace function get_org_groups(p_org_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text; v_is_admin bool;
begin
  select id into v_caller_id from trader_users where auth_user_id = auth.uid();
  select org_role into v_caller_role from org_memberships where user_id = v_caller_id and org_id = p_org_id;
  if not found then return jsonb_build_object('ok',false,'error','Not a member of this organisation'); end if;
  v_is_admin := v_caller_role in ('owner','admin');
  return (
    select jsonb_build_object('ok',true,'is_admin',v_is_admin,'groups',jsonb_agg(
      jsonb_build_object('id',g.id,'name',g.name,'member_count',coalesce(mc.cnt,0),
        'is_my_group',exists(select 1 from org_group_members where group_id = g.id and user_id = v_caller_id))
      order by g.created_at
    ))
    from org_groups g
    left join (select group_id, count(*)::int as cnt from org_group_members group by group_id) mc on mc.group_id = g.id
    where g.org_id = p_org_id
      and (v_is_admin or exists(select 1 from org_group_members where group_id = g.id and user_id = v_caller_id))
  );
end;$$;

create or replace function get_group_leaderboard(p_group_id uuid, p_sort text default 'lifetime_pnl')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_caller_id uuid; v_caller_role text; v_is_admin bool;
  v_on_lb bool; v_org_id uuid; v_month_start timestamptz; v_result jsonb;
begin
  select id into v_caller_id from trader_users where auth_user_id = auth.uid();
  select org_id into v_org_id from org_groups where id = p_group_id;
  select org_role, on_leaderboard into v_caller_role, v_on_lb
  from org_memberships where user_id = v_caller_id and org_id = v_org_id;
  if not found then return jsonb_build_object('ok',false,'error','Not a member of this organisation'); end if;
  v_is_admin    := v_caller_role in ('owner','admin');
  v_month_start := date_trunc('month', now());
  if p_sort not in ('lifetime_pnl','monthly_pnl','win_rate','avg_r') then p_sort := 'lifetime_pnl'; end if;
  with stats as (
    select tu.id as user_id, tu.display_name, tu.avatar_url,
      (tu.id = v_caller_id) as is_current_user, om.org_role, om.on_leaderboard,
      count(*) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT'))::int as total_closed,
      count(*) filter (where t.status = 'OPEN')::int as open_trades,
      coalesce(sum(t.realised_pnl) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT')),0) as lifetime_pnl,
      coalesce(sum(t.realised_pnl) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT') and t.created_at >= v_month_start),0) as monthly_pnl,
      case when count(*) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT')) = 0 then null
        else round(100.0 * count(*) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT') and coalesce(t.realised_pnl,0) > 0)::numeric
          / count(*) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT')), 2) end as win_rate,
      case when count(*) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT') and coalesce(t.risk_amount,0) > 0) = 0 then null
        else round(avg(t.realised_pnl / nullif(t.risk_amount,0)) filter (where t.status in ('CLOSED','STOPPED','TARGET_HIT') and coalesce(t.risk_amount,0) > 0), 3) end as avg_r
    from org_group_members ogm
    join trader_users tu on tu.id = ogm.user_id
    join org_memberships om on om.user_id = ogm.user_id and om.org_id = v_org_id
    left join trades t on t.user_id = tu.id and t.deleted_at is null
    where ogm.group_id = p_group_id and (om.on_leaderboard = true or tu.id = v_caller_id)
    group by tu.id, tu.display_name, tu.avatar_url, om.org_role, om.on_leaderboard
  ),
  ranked as (
    select *, row_number() over (order by case p_sort
      when 'lifetime_pnl' then lifetime_pnl when 'monthly_pnl' then monthly_pnl
      when 'win_rate' then coalesce(win_rate,-1) when 'avg_r' then coalesce(avg_r,-999)
    end desc) as rank from stats
  )
  select jsonb_build_object('ok',true,'is_admin',v_is_admin,'i_am_on_lb',v_on_lb,'group_id',p_group_id,
    'rows', jsonb_agg(
      case when v_is_admin then
        jsonb_build_object('rank',rank,'user_id',user_id,'display_name',display_name,
          'avatar_url',avatar_url,'is_current_user',is_current_user,'on_leaderboard',on_leaderboard,
          'total_closed',total_closed,'open_trades',open_trades,'lifetime_pnl',lifetime_pnl,
          'monthly_pnl',monthly_pnl,'win_rate',win_rate,'avg_r',avg_r)
      else
        jsonb_build_object('rank',rank,'user_id',user_id,'display_name',display_name,
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


-- ================================================================
-- 9. SUPER ADMIN RPCs
-- ================================================================

-- Trigger: auto-grant role = 'admin' when someone becomes org owner
create or replace function _grant_admin_on_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.org_role = 'owner' then
    update trader_users set role = 'admin' where id = NEW.user_id and role = 'user';
  end if;
  return NEW;
end;$$;

drop trigger if exists trg_grant_admin_on_owner on org_memberships;
create trigger trg_grant_admin_on_owner
  after insert on org_memberships
  for each row execute function _grant_admin_on_owner();

create or replace function super_admin_list_orgs()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text;
begin
  select tu.id, tu.role into v_caller_id, v_caller_role from trader_users tu where tu.auth_user_id = auth.uid() limit 1;
  if v_caller_role is distinct from 'admin' then return jsonb_build_object('ok',false,'error','Not authorised'); end if;
  return jsonb_build_object('ok',true,'orgs',(
    select jsonb_agg(jsonb_build_object(
      'id',o.id,'name',o.name,'slug',o.slug,'domain',o.domain,'currency',o.currency,
      'created_at',o.created_at,'my_role',om_me.org_role,
      'member_count',(select count(*) from org_memberships om2 where om2.org_id = o.id)
    ) order by om_me.joined_at asc)
    from org_memberships om_me join organisations o on o.id = om_me.org_id
    where om_me.user_id = v_caller_id
  ));
end;$$;

create or replace function super_admin_create_org(p_name text, p_domain text default null, p_currency text default 'INR')
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return create_org_with_owner(p_name, p_domain, p_currency);
end;$$;

-- Keep old 4-param signature for backward compat with /super/new page
create or replace function super_admin_create_org(p_name text, p_owner_email text, p_domain text default null, p_currency text default 'INR')
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return create_org_with_owner(p_name, p_domain, p_currency);
end;$$;

create or replace function super_admin_set_active_org(p_org_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text;
begin
  select tu.id, tu.role into v_caller_id, v_caller_role from trader_users tu where tu.auth_user_id = auth.uid() limit 1;
  if v_caller_role is distinct from 'admin' then return jsonb_build_object('ok',false,'error','Not authorised'); end if;
  if not exists (select 1 from org_memberships where user_id = v_caller_id and org_id = p_org_id) then
    return jsonb_build_object('ok',false,'error','Not a member of that organisation');
  end if;
  update trader_users set active_org_id = p_org_id, org_id = p_org_id where id = v_caller_id;
  return jsonb_build_object('ok',true);
end;$$;

create or replace function super_admin_get_org_detail(p_org_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text;
begin
  select tu.id, tu.role into v_caller_id, v_caller_role from trader_users tu where tu.auth_user_id = auth.uid() limit 1;
  if v_caller_role is distinct from 'admin' then return jsonb_build_object('ok',false,'error','Not authorised'); end if;
  if not exists (select 1 from org_memberships where user_id = v_caller_id and org_id = p_org_id) then
    return jsonb_build_object('ok',false,'error','Organisation not found');
  end if;
  return jsonb_build_object(
    'ok',true,
    'org',(select row_to_json(o) from organisations o where o.id = p_org_id),
    'members',(
      select jsonb_agg(jsonb_build_object(
        'id',tu.id,'display_name',tu.display_name,'avatar_url',tu.avatar_url,
        'email',au.email,'org_role',om.org_role,'capital_limit',coalesce(tu.capital_limit,100000),
        'joined_at',om.joined_at,'group_id',ogm.group_id,'group_name',og.name,
        'is_super_admin',(tu.role = 'admin')
      ) order by om.joined_at)
      from org_memberships om
      join trader_users tu on tu.id = om.user_id
      left join auth.users au on au.id = tu.auth_user_id
      left join org_group_members ogm on ogm.user_id = tu.id and ogm.org_id = p_org_id
      left join org_groups og on og.id = ogm.group_id
      where om.org_id = p_org_id
    ),
    'groups',(
      select jsonb_agg(jsonb_build_object(
        'id',og.id,'name',og.name,
        'member_count',(select count(*) from org_group_members ogm2 where ogm2.group_id = og.id)
      ) order by og.name)
      from org_groups og where og.org_id = p_org_id
    )
  );
end;$$;

create or replace function super_admin_delete_org(p_org_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_caller_id uuid; v_caller_role text; v_my_org_role text; v_next_org_id uuid;
begin
  select tu.id, tu.role into v_caller_id, v_caller_role from trader_users tu where tu.auth_user_id = auth.uid() limit 1;
  if v_caller_role is distinct from 'admin' then return jsonb_build_object('ok',false,'error','Not authorised'); end if;
  select org_role into v_my_org_role from org_memberships where user_id = v_caller_id and org_id = p_org_id;
  if v_my_org_role is distinct from 'owner' then return jsonb_build_object('ok',false,'error','You are not the owner of this organisation'); end if;
  -- Null out org_id on ALL members first (satisfies FK constraint)
  update trader_users set org_id = null,
    user_type = case when role = 'admin' then user_type else 'indie' end
  where id in (select user_id from org_memberships where org_id = p_org_id);
  -- Cascade deletes
  delete from org_group_members where group_id in (select id from org_groups where org_id = p_org_id);
  delete from org_groups      where org_id = p_org_id;
  delete from org_memberships where org_id = p_org_id;
  delete from org_invites     where org_id = p_org_id;
  delete from organisations   where id     = p_org_id;
  -- Restore caller to next org, or indie
  select org_id into v_next_org_id from org_memberships where user_id = v_caller_id order by joined_at asc limit 1;
  if v_next_org_id is not null then
    update trader_users set user_type = 'org_admin', org_id = v_next_org_id, active_org_id = v_next_org_id where id = v_caller_id;
  else
    update trader_users set user_type = 'indie', org_id = null, active_org_id = null where id = v_caller_id;
  end if;
  return jsonb_build_object('ok',true);
end;$$;

create or replace function super_admin_assign_co_owner(p_org_id uuid, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_caller_id uuid; v_caller_role text; v_caller_org_role text;
  v_target_auth uuid; v_target_id uuid; v_target_role text;
begin
  select tu.id, tu.role into v_caller_id, v_caller_role from trader_users tu where tu.auth_user_id = auth.uid() limit 1;
  if v_caller_role is distinct from 'admin' then return jsonb_build_object('ok',false,'error','Not authorised'); end if;
  select org_role into v_caller_org_role from org_memberships where user_id = v_caller_id and org_id = p_org_id;
  if v_caller_org_role is distinct from 'owner' then return jsonb_build_object('ok',false,'error','You are not the owner of this organisation'); end if;
  select au.id into v_target_auth from auth.users au where lower(au.email) = lower(p_email) limit 1;
  if v_target_auth is null then return jsonb_build_object('ok',false,'error','No user found with that email'); end if;
  select tu.id, tu.role into v_target_id, v_target_role from trader_users tu where tu.auth_user_id = v_target_auth limit 1;
  if v_target_id is null then return jsonb_build_object('ok',false,'error','User has not signed in yet'); end if;
  if v_target_role = 'admin' then return jsonb_build_object('ok',false,'error','Cannot assign a super admin as co-owner'); end if;
  if v_target_id = v_caller_id then return jsonb_build_object('ok',false,'error','You are already the owner'); end if;
  update org_memberships om set org_role = 'admin'
  from trader_users tu
  where tu.id = om.user_id and om.org_id = p_org_id and om.org_role = 'owner'
    and tu.role != 'admin' and om.user_id != v_target_id;
  insert into org_memberships (user_id, org_id, org_role, joined_at)
  values (v_target_id, p_org_id, 'owner', now())
  on conflict (org_id, user_id) do update set org_role = 'owner';
  update trader_users set user_type = 'org_admin', org_id = p_org_id, org_role = 'owner' where id = v_target_id;
  return jsonb_build_object('ok',true);
end;$$;

alter function super_admin_list_orgs()                          owner to postgres;
alter function super_admin_create_org(text,text,text)           owner to postgres;
alter function super_admin_create_org(text,text,text,text)      owner to postgres;
alter function super_admin_set_active_org(uuid)                 owner to postgres;
alter function super_admin_get_org_detail(uuid)                 owner to postgres;
alter function super_admin_delete_org(uuid)                     owner to postgres;
alter function super_admin_assign_co_owner(uuid,text)           owner to postgres;

grant execute on function super_admin_list_orgs()                     to authenticated;
grant execute on function super_admin_create_org(text,text,text)      to authenticated;
grant execute on function super_admin_create_org(text,text,text,text) to authenticated;
grant execute on function super_admin_set_active_org(uuid)            to authenticated;
grant execute on function super_admin_get_org_detail(uuid)            to authenticated;
grant execute on function super_admin_delete_org(uuid)                to authenticated;
grant execute on function super_admin_assign_co_owner(uuid,text)      to authenticated;


-- ================================================================
-- DONE.
-- After running:
-- 1. Grant yourself super admin:
--    UPDATE trader_users SET role = 'admin'
--    FROM auth.users au
--    WHERE au.id = trader_users.auth_user_id AND au.email = 'your@email.com';
-- ================================================================
