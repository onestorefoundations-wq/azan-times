-- ============================================================================
-- 04_public_page.sql
--
-- A public, read-only prayer-times page per mosque, so a QR code on the display
-- lets the congregation install the times as a PWA on their phone.
--
-- Nothing here relaxes RLS. The page is served by the `public-times` Edge
-- Function using the service role, which returns a hard-coded whitelist of
-- display fields. The anon key still reaches nothing directly.
--
-- Opt-in per mosque: public_page_enabled defaults to FALSE, so registering an
-- account does not publish a mosque's name and coordinates at a guessable URL.
--
-- Idempotent: safe to re-run. Run after 03_section_sync.sql.
-- ============================================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS public_slug TEXT,
  ADD COLUMN IF NOT EXISTS public_page_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_public_slug_key
  ON tenants (public_slug) WHERE public_slug IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Slug generation
--
-- Derived from the mosque name so the QR encodes /m/central-mosque rather than
-- a UUID. Regenerating a slug revokes every previously shared link and QR,
-- which is the only takedown mechanism a public page needs.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION slugify(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT trim(both '-' from
           regexp_replace(
             regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'),
             '-+', '-', 'g'
           )
         );
$fn$;

CREATE OR REPLACE FUNCTION set_public_page(
  p_tenant_id UUID,
  p_enabled   BOOLEAN,
  p_slug      TEXT DEFAULT NULL
)
RETURNS TABLE (public_slug TEXT, public_page_enabled BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER          -- needs to test slug uniqueness across all tenants
SET search_path = public
AS $fn$
DECLARE
  v_base    TEXT;
  v_slug    TEXT;
  v_suffix  INTEGER := 0;
  v_current TEXT;
BEGIN
  -- SECURITY DEFINER bypasses RLS, so re-check the caller owns this tenant.
  IF p_tenant_id IS DISTINCT FROM jwt_tenant_id() THEN
    RAISE EXCEPTION 'Not your tenant';
  END IF;

  SELECT t.public_slug INTO v_current FROM tenants t WHERE t.id = p_tenant_id;

  IF p_slug IS NULL AND v_current IS NOT NULL THEN
    v_slug := v_current;                        -- keep the existing link alive
  ELSE
    SELECT slugify(coalesce(nullif(p_slug, ''), t.name)) INTO v_base
      FROM tenants t WHERE t.id = p_tenant_id;

    IF v_base IS NULL OR v_base = '' THEN
      v_base := 'masjid';
    END IF;

    v_slug := v_base;
    WHILE EXISTS (
      SELECT 1 FROM tenants t WHERE t.public_slug = v_slug AND t.id <> p_tenant_id
    ) LOOP
      v_suffix := v_suffix + 1;
      v_slug := v_base || '-' || v_suffix;
    END LOOP;
  END IF;

  UPDATE tenants t
     SET public_slug = v_slug,
         public_page_enabled = p_enabled
   WHERE t.id = p_tenant_id;

  RETURN QUERY SELECT v_slug, p_enabled;
END;
$fn$;

REVOKE ALL ON FUNCTION set_public_page(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_public_page(UUID, BOOLEAN, TEXT) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Read side for the Edge Function
--
-- A whitelist, not a blacklist: config_json holds whatever a client wrote, so
-- naming the safe keys is the only way to guarantee nothing sensitive escapes
-- when a new setting is added later. display_settings is excluded entirely --
-- the congregation's phone renders its own layout, and that block is where a
-- PIN hash would end up if a stale client ever pushed one.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public_prayer_times(p_slug TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
           'mosque_name', t.name,
           'slug', t.public_slug,
           'config_version', c.config_version,
           'updated_at', c.updated_at,
           'masjid_profile', c.config_json -> 'masjid_profile',
           'time_adjustments', c.config_json -> 'time_adjustments',
           'features_format', c.config_json -> 'features_format',
           'jumuah_settings', c.config_json -> 'jumuah_settings'
         )
    FROM tenants t
    JOIN mosque_configs c ON c.tenant_id = t.id
   WHERE t.public_slug = p_slug
     AND t.public_page_enabled
   LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION public_prayer_times(TEXT) FROM PUBLIC;
-- service_role only: reached through the public-times Edge Function, never by
-- a browser holding the anon key.
GRANT EXECUTE ON FUNCTION public_prayer_times(TEXT) TO service_role;
