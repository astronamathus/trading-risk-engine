-- Fix Google OAuth onboarding with RLS enabled on trader_users.
-- Authenticated users can create/read/update only their own profile row, and
-- organisation-member profile reads use a SECURITY DEFINER helper to avoid
-- recursive trader_users policies.

alter table public.trader_users enable row level security;

create or replace function public.get_my_trader_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id
  from public.trader_users
  where auth_user_id = auth.uid()
  limit 1;
$$;

grant execute on function public.get_my_trader_id()
to authenticated;

drop policy if exists "Users can insert own profile" on public.trader_users;
drop policy if exists "Users can read own profile" on public.trader_users;
drop policy if exists "Users can update own profile" on public.trader_users;
drop policy if exists "Org members can read each other" on public.trader_users;

create policy "Users can insert own profile"
on public.trader_users
for insert
to authenticated
with check (auth_user_id = auth.uid());

create policy "Users can read own profile"
on public.trader_users
for select
to authenticated
using (auth_user_id = auth.uid());

create policy "Users can update own profile"
on public.trader_users
for update
to authenticated
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

create policy "Org members can read each other"
on public.trader_users
for select
to authenticated
using (
  id in (
    select om2.user_id
    from public.org_memberships om1
    join public.org_memberships om2 on om1.org_id = om2.org_id
    where om1.user_id = public.get_my_trader_id()
  )
);
