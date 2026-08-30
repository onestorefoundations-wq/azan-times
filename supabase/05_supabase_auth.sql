-- ============================================================================
-- 05_supabase_auth.sql
--
-- Moves authentication onto Supabase Auth and stops minting our own JWTs.
--
-- Why: this project's signing keys have moved to ES256 ("in_use"), and the
-- HS256 secret the custom `auth` function would have signed with is marked
-- "previously_used". Legacy verification is still enabled, so a hand-rolled
-- HS256 token works today -- and stops working the day legacy JWT support is
-- switched off, logging out every display at once. Supabase Auth signs with
-- whatever the current key is, so this stops being our problem.
--
-- It also removes the last secret from the deployment: nothing needs the
-- project's JWT secret any more.
--
-- Passwords carry over untouched. 02 bcrypted admin_users.password_hash with
-- pgcrypto, and GoTrue stores bcrypt in auth.users.encrypted_password, so the
-- existing digests are simply copied -- nobody has to reset anything.
--
-- Idempotent: safe to re-run. Run after 04_public_page.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Mirror admin_users into auth.users
--
-- The auth user keeps the admin_users id, so the two stay trivially joinable
-- and re-running this updates in place rather than creating duplicates.
--
-- Half the accounts have no email address. Auth requires one and it must be
-- unique, so those get a synthetic address on a domain that cannot collide
-- with a real one; they continue to sign in by username, which the `auth`
-- Edge Function resolves to this address.
-- ---------------------------------------------------------------------------

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  u.id,
  'authenticated',
  'authenticated',
  lower(coalesce(nullif(u.email, ''), u.username || '@no-email.masjid.invalid')),
  u.password_hash,
  -- No mail is deliverable to the synthetic addresses, so confirm up front;
  -- these are existing accounts that were already trusted.
  now(),
  jsonb_build_object(
    'provider', 'email',
    'providers', jsonb_build_array('email'),
    -- Read by jwt_tenant_id(). app_metadata is the right home for it: unlike
    -- user_metadata it cannot be edited by the user's own session.
    'tenant_id', u.tenant_id,
    'username', u.username
  ),
  jsonb_build_object('username', u.username),
  coalesce(u.created_at, now()),
  now()
FROM admin_users u
ON CONFLICT (id) DO UPDATE
  SET email              = EXCLUDED.email,
      encrypted_password = EXCLUDED.encrypted_password,
      raw_app_meta_data  = EXCLUDED.raw_app_meta_data,
      updated_at         = now();

-- GoTrue expects an identity row per login method; without it
-- signInWithPassword rejects the account even though the password matches.
INSERT INTO auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at,
  created_at, updated_at
)
SELECT
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(), now(), now()
FROM auth.users u
ON CONFLICT (provider, provider_id) DO UPDATE
  SET identity_data = EXCLUDED.identity_data,
      updated_at    = now();

-- ---------------------------------------------------------------------------
-- 2. Read tenant_id from the Supabase-issued token
--
-- Supabase puts app_metadata into the JWT, so the claim moves from a top-level
-- tenant_id (which only our own signer could have put there) to
-- app_metadata.tenant_id. The old location is still honoured so that any
-- client still holding a self-minted token keeps working during rollout.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION jwt_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $fn$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb
             -> 'app_metadata' ->> 'tenant_id', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb
             ->> 'tenant_id', '')
  )::uuid;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. Registration
--
-- Creating the auth user is GoTrue's job (the Edge Function calls the admin
-- API for it), so app_register now only creates the tenant and the
-- admin_users row and hands back the ids. Password validation stays here
-- because it is the one rule both callers must not be able to skip.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS app_register(TEXT, TEXT, TEXT, TEXT, TEXT);

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
          crypt(p_password, gen_salt('bf', 12)))
  RETURNING id INTO v_user_id;

  RETURN QUERY SELECT v_user_id, v_tenant_id, p_username, p_mobile, p_email, p_mosque_name;
END;
$fn$;

REVOKE ALL ON FUNCTION app_register(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_register(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Identifier lookup for sign-in
--
-- People sign in with a username or a mobile number, but GoTrue only knows
-- email addresses. This resolves one to the other. service_role only, so it
-- cannot be used from a browser to enumerate accounts.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_email_for_identifier(p_identifier TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT lower(coalesce(nullif(u.email, ''), u.username || '@no-email.masjid.invalid'))
    FROM admin_users u
   WHERE u.username = p_identifier
      OR u.mobile   = p_identifier
      OR lower(u.email) = lower(p_identifier)
   LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION app_email_for_identifier(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_email_for_identifier(TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Retire the hand-rolled password check
--
-- app_login compared a password against admin_users. GoTrue does that now, so
-- leaving it in place would be a second, weaker way in.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS app_login(TEXT, TEXT);
DROP FUNCTION IF EXISTS app_refresh(UUID);
