-- ============================================================================
-- 03_section_sync.sql
--
-- Per-section config sync.
--
-- The config was one JSONB blob with one version number, so concurrent edits
-- were whole-document last-writer-wins: an admin changing prayer times on a
-- phone and someone changing the theme on the TV would clobber each other, and
-- an offline TV coming back online would overwrite everything the phone had
-- done in the meantime.
--
-- Each top-level section now carries its own version in `section_versions`, and
-- a push merges only the sections the caller actually changed. Two devices
-- editing different sections no longer collide at all, which is the normal case
-- (phone edits times and slides, TV edits display).
--
-- Also strips device-local keys on write. Orientation, the local background
-- path and the admin PIN are properties of one physical screen, not of the
-- mosque: syncing them rotated every TV in a masjid at once and pushed the PIN
-- hash into a row that a public read endpoint could later expose.
--
-- Idempotent: safe to re-run. Run after 02_security_hardening.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Per-section version map
-- ---------------------------------------------------------------------------

ALTER TABLE mosque_configs
  ADD COLUMN IF NOT EXISTS section_versions JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Existing rows: seed every section it already holds at the row's current
-- version, so clients that have pulled that version consider themselves current
-- and nothing re-pushes on first contact.
UPDATE mosque_configs
   SET section_versions = (
         SELECT coalesce(jsonb_object_agg(key, config_version), '{}'::jsonb)
           FROM jsonb_object_keys(config_json) AS key
       )
 WHERE section_versions = '{}'::jsonb
   AND config_json IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Device-local keys, stripped on every write
--
-- Defence in depth: the clients stopped sending these, but a stale build or a
-- hand-rolled request must not be able to put a PIN hash back into a row that
-- the public prayer-times endpoint reads from.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION strip_device_local_keys(p_sections JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $fn$
DECLARE
  v_display JSONB;
BEGIN
  IF p_sections IS NULL OR NOT p_sections ? 'display_settings' THEN
    RETURN coalesce(p_sections, '{}'::jsonb);
  END IF;

  v_display := (p_sections -> 'display_settings')
             - 'pin_hash'
             - 'pin_enabled'
             - 'display_orientation'
             - 'show_orientation_fab'
             - 'custom_background_path'
             - 'admin_light_theme';

  RETURN jsonb_set(p_sections, '{display_settings}', v_display);
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. Section-wise push
--
-- p_sections holds ONLY the sections the caller changed. Everything else in
-- config_json is left exactly as it is, so a device that has been offline for a
-- week cannot revert sections it never touched.
--
-- Returns the merged document plus the new version map, so the caller can
-- record what it is now in step with without a second round trip.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION push_config_sections(
  p_tenant_id UUID,
  p_sections  JSONB,
  p_device_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER          -- deliberate: RLS from 02_security_hardening.sql applies
SET search_path = public
AS $fn$
DECLARE
  v_clean       JSONB := strip_device_local_keys(p_sections);
  v_existing    mosque_configs%ROWTYPE;
  v_versions    JSONB;
  v_merged      JSONB;
  v_next        INTEGER;
  v_key         TEXT;
BEGIN
  IF v_clean IS NULL OR v_clean = '{}'::jsonb THEN
    RAISE EXCEPTION 'push_config_sections called with no sections';
  END IF;

  SELECT * INTO v_existing FROM mosque_configs WHERE tenant_id = p_tenant_id FOR UPDATE;

  IF NOT FOUND THEN
    v_next := 1;
    v_versions := '{}'::jsonb;
    FOR v_key IN SELECT jsonb_object_keys(v_clean) LOOP
      v_versions := jsonb_set(v_versions, ARRAY[v_key], to_jsonb(v_next));
    END LOOP;

    INSERT INTO mosque_configs (tenant_id, config_version, config_json, section_versions, updated_at, updated_by)
    VALUES (p_tenant_id, v_next, v_clean, v_versions, NOW(), p_device_id);

    RETURN jsonb_build_object(
      'config_version', v_next,
      'section_versions', v_versions,
      'config_json', v_clean
    );
  END IF;

  v_next := v_existing.config_version + 1;
  v_versions := coalesce(v_existing.section_versions, '{}'::jsonb);
  v_merged := coalesce(v_existing.config_json, '{}'::jsonb);

  -- Shallow-merge each section rather than replacing it. The Flutter client
  -- carries display_settings keys the React client has no field for
  -- (ticker_bg_color, tv_background_color, theme_id); a replace would let
  -- whichever client pushed last silently drop the other's settings.
  FOR v_key IN SELECT jsonb_object_keys(v_clean) LOOP
    IF jsonb_typeof(v_merged -> v_key) = 'object'
       AND jsonb_typeof(v_clean -> v_key) = 'object' THEN
      v_merged := jsonb_set(v_merged, ARRAY[v_key], (v_merged -> v_key) || (v_clean -> v_key));
    ELSE
      v_merged := jsonb_set(v_merged, ARRAY[v_key], v_clean -> v_key, true);
    END IF;
  END LOOP;

  -- Only the sections in this push advance; the rest keep the version they had.
  FOR v_key IN SELECT jsonb_object_keys(v_clean) LOOP
    v_versions := jsonb_set(v_versions, ARRAY[v_key], to_jsonb(v_next));
  END LOOP;

  UPDATE mosque_configs
     SET config_version   = v_next,
         config_json      = v_merged,
         section_versions = v_versions,
         updated_at       = NOW(),
         updated_by       = p_device_id
   WHERE tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'config_version', v_next,
    'section_versions', v_versions,
    'config_json', v_merged
  );
END;
$fn$;

REVOKE ALL ON FUNCTION push_config_sections(UUID, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION push_config_sections(UUID, JSONB, TEXT) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Keep the whole-document push working, but make it section-aware
--
-- Anything still calling increment_and_push_config replaces the document, so
-- every section it carries advances. Superadmin registration seeds a config
-- through this path.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION increment_and_push_config(
  p_tenant_id   UUID,
  p_config_json JSONB,
  p_device_id   TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_result JSONB;
BEGIN
  v_result := push_config_sections(p_tenant_id, p_config_json, p_device_id);
  RETURN (v_result ->> 'config_version')::integer;
END;
$fn$;

REVOKE ALL ON FUNCTION increment_and_push_config(UUID, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_and_push_config(UUID, JSONB, TEXT) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Retire the device-local keys already sitting in stored configs
-- ---------------------------------------------------------------------------

UPDATE mosque_configs
   SET config_json = strip_device_local_keys(config_json)
 WHERE config_json ? 'display_settings'
   AND (config_json -> 'display_settings') ?| ARRAY[
         'pin_hash', 'pin_enabled', 'display_orientation',
         'show_orientation_fab', 'custom_background_path', 'admin_light_theme'
       ];
