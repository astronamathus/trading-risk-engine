-- Create an organisation for the currently authenticated user and make them admin.
-- This keeps the organisation insert and trader_users update in a single
-- database-side transaction so browser clients do not need broad insert/update
-- RLS policies for onboarding.

create or replace function public.create_organisation_for_current_user(
  p_name text,
  p_domain text default null
)
returns public.organisations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org public.organisations;
  v_base_slug text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Organisation name is required';
  end if;

  select id
  into v_user_id
  from public.trader_users
  where auth_user_id = auth.uid();

  if v_user_id is null then
    raise exception 'No trader_users row exists for current auth user';
  end if;

  v_base_slug := lower(regexp_replace(trim(p_name), '[^a-z0-9]+', '-', 'g'));
  v_base_slug := regexp_replace(v_base_slug, '(^-|-$)', '', 'g');

  if v_base_slug = '' then
    v_base_slug := 'organisation';
  end if;

  insert into public.organisations (name, slug, domain)
  values (
    trim(p_name),
    v_base_slug || '-' || extract(epoch from now())::bigint::text,
    nullif(trim(p_domain), '')
  )
  returning *
  into v_org;

  update public.trader_users
  set
    org_id = v_org.id,
    org_role = 'admin',
    user_type = 'org_admin'
  where id = v_user_id;

  return v_org;
end;
$$;

grant execute on function public.create_organisation_for_current_user(text, text)
to authenticated;
