-- ⚠️ SUPERSEDED IN PART BY 02_security_hardening.sql.
-- The RLS policies below are all USING (true): with the anon key embedded in
-- every shipped bundle, they give any user read/write access to every
-- tenant's data and read access to every password. Run 02 immediately after
-- this file on a fresh project; never run this one on its own.
-- 02 also adds the media_library table and the increment_and_push_config RPC,
-- both of which the clients already call but which were never in this file.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tenants Table
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mosque Configs Table
CREATE TABLE mosque_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  config_version INTEGER NOT NULL DEFAULT 1,
  config_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Device Registry Table
CREATE TABLE device_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL UNIQUE,
  last_seen TIMESTAMPTZ,
  app_version TEXT,
  online_status BOOLEAN DEFAULT FALSE
);

-- Admin Users Table (Custom Auth)
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  mobile TEXT,
  email TEXT,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS)

-- 1. Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE mosque_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 2. Relaxed Policies for Application-Level Security
-- Since we are bypassing Supabase Auth for a custom login table, 
-- we allow the Anon Key to perform operations. The React dashboard 
-- will handle security by forcing a login screen and filtering by tenant_id.

CREATE POLICY "Allow public read access to tenants" ON tenants FOR SELECT USING (true);
CREATE POLICY "Allow public insert to tenants for registration" ON tenants FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public full access to configs" ON mosque_configs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to registry" ON device_registry FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read access to admin_users for login" ON admin_users FOR SELECT USING (true);
CREATE POLICY "Allow public insert to admin_users for registration" ON admin_users FOR INSERT WITH CHECK (true);

-- Enable Realtime for mosque_configs so TV displays sync changes immediately
alter publication supabase_realtime add table mosque_configs;

