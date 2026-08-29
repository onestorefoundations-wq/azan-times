-- ============================================================================
-- 02_security_hardening.sql
--
-- Fixes, in order:
--   1. Plaintext passwords in admin_users.password_hash  -> bcrypt via pgcrypto
--   2. RLS policies of USING (true)                      -> tenant-scoped on JWT
--   3. Anon SELECT on admin_users (leaks every password) -> revoked entirely
--   4. Missing media_library table                       -> created
--   5. Missing increment_and_push_config RPC             -> created, atomic
--   6. device_registry.online_status never cleared       -> last_seen-based view
--
-- Run once against the project (SQL editor or `supabase db push`).
-- Idempotent: safe to re-run.
--
-- AFTER RUNNING: deploy supabase/functions/auth and supabase/functions/media-proxy,
-- and set the function secrets listed in supabase/functions/README.md.
-- Clients older than this migration WILL STOP WORKING -- that is the point;
-- they authenticate by reading password_hash straight off the table.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- 0. Tables that were missing from 01_create_db.sql
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS media_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  category TEXT NOT NULL,
  is_active_background BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by_device TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS media_library_tenant_idx ON media_library (tenant_id, is_deleted);

-- One config row per tenant. The read-increment-write push path always assumed
-- this but nothing enforced it, so two devices could create duplicate rows.
CREATE UNIQUE INDEX IF NOT EXISTS mosque_configs_tenant_key ON mosque_configs (tenant_id);

-- device_id was globally unique, so a colliding id silently steals another
-- tenant's row. Scope uniqueness to the tenant.
ALTER TABLE device_registry DROP CONSTRAINT IF EXISTS device_registry_device_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS device_registry_tenant_device_key
  ON device_registry (tenant_id, device_id);

-- ---------------------------------------------------------------------------
-- 1. Password migration: plaintext -> bcrypt
--    Existing rows stored the password verbatim in password_hash. A bcrypt
--    digest always starts with '$2'; anything else is a legacy plaintext value.
-- ---------------------------------------------------------------------------

UPDATE admin_users
   SET password_hash = extensions.crypt(password_hash, extensions.gen_salt('bf', 12))
 WHERE password_hash IS NOT NULL
   AND password_hash NOT LIKE '$2%';

-- ---------------------------------------------------------------------------
-- 2. Auth RPCs. SECURITY DEFINER so they can read admin_users while RLS keeps
--    every client out of it. Executable by service_role only -- i.e. from the
--    `auth` Edge Function, never from a browser holding the anon key.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_login(p_identifier TEXT, p_password TEXT)
RETURNS TABLE (user_id UUID, tenant_id UUID, username TEXT, mobile TEXT, email TEXT, mosque_name TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
  SELECT u.id, u.tenant_id, u.username, u.mobile, u.email, t.name
    FROM admin_users u
    JOIN tenants t ON t.id = u.tenant_id
   WHERE (u.username = p_identifier OR u.mobile = p_identifier OR u.email = p_identifier)
     AND u.password_hash = extensions.crypt(p_password, u.password_hash)
   LIMIT 1;
$fn$;

CREATE OR REPLACE FUNCTION app_register(
  p_mosque_name TEXT,
  p_username    TEXT,
  p_password    TEXT,
  p_mobile      TEXT DEFAULT NULL,
  p_email       TEXT DEFAULT NULL
)
RETURNS TABLE (user_id UUID, tenant_id UUID, username TEXT, mobile TEXT, email TEXT, mosque_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
DECLARE
  v_tenant_id UUID;
  v_user_id   UUID;
BEGIN
  IF length(coalesce(p_password, '')) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;
  IF EXISTS (SELECT 1 FROM admin_users au WHERE au.username = p_username) THEN
    RAISE EXCEPTION 'Username already registered';
  END IF;

  INSERT INTO tenants (name) VALUES (p_mosque_name) RETURNING id INTO v_tenant_id;

  INSERT INTO admin_users (tenant_id, username, mobile, email, password_hash)
  VALUES (v_tenant_id, p_username, p_mobile, p_email,
          extensions.crypt(p_password, extensions.gen_salt('bf', 12)))
  RETURNING id INTO v_user_id;

  RETURN QUERY SELECT v_user_id, v_tenant_id, p_username, p_mobile, p_email, p_mosque_name;
END;
$fn$;

-- Re-issuing a token needs only that the user still exists and is still
-- attached to a tenant. No password involved.
CREATE OR REPLACE FUNCTION app_refresh(p_user_id UUID)
RETURNS TABLE (user_id UUID, tenant_id UUID, username TEXT, mobile TEXT, email TEXT, mosque_name TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $fn$
  SELECT u.id, u.tenant_id, u.username, u.mobile, u.email, t.name
    FROM admin_users u
    JOIN tenants t ON t.id = u.tenant_id
   WHERE u.id = p_user_id
   LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION app_login(TEXT, TEXT)                      FROM PUBLIC;
REVOKE ALL ON FUNCTION app_register(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_refresh(UUID)                          FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_login(TEXT, TEXT)                      TO service_role;
GRANT EXECUTE ON FUNCTION app_register(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION app_refresh(UUID)                          TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Atomic config push. Replaces the read-increment-write fallback that let
--    two devices compute the same next version and lose one of the writes.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION increment_and_push_config(
  p_tenant_id   UUID,
  p_config_json JSONB,
  p_device_id   TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER          -- deliberate: the RLS policies below still apply
SET search_path = public
AS $fn$
DECLARE
  v_version INTEGER;
BEGIN
  INSERT INTO mosque_configs (tenant_id, config_version, config_json, updated_at, updated_by)
  VALUES (p_tenant_id, 1, p_config_json, NOW(), p_device_id)
  ON CONFLICT (tenant_id) DO UPDATE
     SET config_version = mosque_configs.config_version + 1,
         config_json    = EXCLUDED.config_json,
         updated_at     = NOW(),
         updated_by     = EXCLUDED.updated_by
  RETURNING config_version INTO v_version;

  RETURN v_version;
END;
$fn$;

REVOKE ALL ON FUNCTION increment_and_push_config(UUID, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_and_push_config(UUID, JSONB, TEXT) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Row Level Security -- tenant scoped, driven by the tenant_id claim that
--    the `auth` Edge Function mints into the JWT.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION jwt_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $fn$
  SELECT nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id', '')::uuid;
$fn$;

ALTER TABLE tenants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE mosque_configs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_library   ENABLE ROW LEVEL SECURITY;

-- Drop every USING (true) policy from 01_create_db.sql.
DROP POLICY IF EXISTS "Allow public read access to tenants"                 ON tenants;
DROP POLICY IF EXISTS "Allow public insert to tenants for registration"     ON tenants;
DROP POLICY IF EXISTS "Allow public full access to configs"                 ON mosque_configs;
DROP POLICY IF EXISTS "Allow public full access to registry"                ON device_registry;
DROP POLICY IF EXISTS "Allow public read access to admin_users for login"   ON admin_users;
DROP POLICY IF EXISTS "Allow public insert to admin_users for registration" ON admin_users;

DROP POLICY IF EXISTS tenants_own_select ON tenants;
DROP POLICY IF EXISTS configs_own_all    ON mosque_configs;
DROP POLICY IF EXISTS registry_own_all   ON device_registry;
DROP POLICY IF EXISTS media_own_all      ON media_library;

CREATE POLICY tenants_own_select ON tenants
  FOR SELECT TO authenticated
  USING (id = jwt_tenant_id());

CREATE POLICY configs_own_all ON mosque_configs
  FOR ALL TO authenticated
  USING (tenant_id = jwt_tenant_id())
  WITH CHECK (tenant_id = jwt_tenant_id());

CREATE POLICY registry_own_all ON device_registry
  FOR ALL TO authenticated
  USING (tenant_id = jwt_tenant_id())
  WITH CHECK (tenant_id = jwt_tenant_id());

CREATE POLICY media_own_all ON media_library
  FOR ALL TO authenticated
  USING (tenant_id = jwt_tenant_id())
  WITH CHECK (tenant_id = jwt_tenant_id());

-- admin_users gets no policy at all. RLS on + zero policies = only service_role
-- (which bypasses RLS) can reach it. Login and registration go through
-- app_login / app_register.
REVOKE ALL ON admin_users FROM anon, authenticated;

GRANT SELECT                         ON tenants         TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON mosque_configs  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON device_registry TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON media_library   TO authenticated;

-- The anon key ships inside every bundle, so it must reach nothing.
REVOKE ALL ON tenants         FROM anon;
REVOKE ALL ON mosque_configs  FROM anon;
REVOKE ALL ON device_registry FROM anon;
REVOKE ALL ON media_library   FROM anon;

-- ---------------------------------------------------------------------------
-- 5. Realtime
-- ---------------------------------------------------------------------------

ALTER TABLE mosque_configs REPLICA IDENTITY FULL;
ALTER TABLE media_library  REPLICA IDENTITY FULL;

DO $do$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE mosque_configs;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$do$;

DO $do$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE media_library;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$do$;

-- ---------------------------------------------------------------------------
-- 6. Liveness. online_status is a latch the client can only ever set to true
--    (a TV that loses power never gets to clear it), so derive liveness from
--    last_seen and read this view instead of the raw column.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW device_status
WITH (security_invoker = true) AS
  SELECT d.*,
         (d.last_seen IS NOT NULL AND d.last_seen > NOW() - INTERVAL '15 minutes') AS is_online
    FROM device_registry d;

GRANT SELECT ON device_status TO authenticated;
