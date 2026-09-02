-- check_migrations.sql
-- Read-only audit: which of 03/04/05 are actually applied to the live database.
-- Paste into the Supabase SQL editor and run. Every row should read 'OK'.
-- A 'MISSING' row names the migration file to run.

with expected(migration, kind, obj) as (
  values
    ('03_section_sync', 'function', 'strip_device_local_keys'),
    ('03_section_sync', 'function', 'push_config_sections'),
    ('03_section_sync', 'function', 'increment_and_push_config'),
    ('03_section_sync', 'column',   'mosque_configs.section_versions'),
    ('04_public_page',  'function', 'slugify'),
    ('04_public_page',  'function', 'set_public_page'),
    ('04_public_page',  'function', 'public_prayer_times'),
    ('05_supabase_auth','function', 'jwt_tenant_id'),
    ('05_supabase_auth','function', 'app_register'),
    ('05_supabase_auth','function', 'app_email_for_identifier')
)
select
  e.migration,
  e.kind,
  e.obj,
  case
    when e.kind = 'function' and exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = e.obj
    ) then 'OK'
    when e.kind = 'column' and exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name  = split_part(e.obj, '.', 1)
        and c.column_name = split_part(e.obj, '.', 2)
    ) then 'OK'
    else 'MISSING'
  end as status
from expected e
order by e.migration, e.obj;

-- Tables that should exist after 01 + 02.
select 'table: ' || t as object,
       case when to_regclass('public.' || t) is null then 'MISSING' else 'OK' end as status
from unnest(array[
  'tenants', 'admin_users', 'mosque_configs', 'media_library',
  'device_registry', 'device_status'
]) as t;
