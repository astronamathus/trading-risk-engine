
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
