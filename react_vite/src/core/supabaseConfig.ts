/**
 * supabaseConfig.ts
 * Project coordinates, split out from supabaseClient so authSession can import
 * them without a cycle (the client's accessToken hook reads from authSession).
 *
 * The anon key is public by design -- it ships inside every bundle. After
 * 02_security_hardening.sql it grants nothing on its own: every table is
 * REVOKEd from anon, and reads require the tenant-scoped JWT from the `auth`
 * Edge Function.
 */

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://veyrcvvvsomyrahjfvhh.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleXJjdnZ2c29teXJhaGpmdmhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjI5MzUsImV4cCI6MjA5NzMzODkzNX0.-N470V130EwnrJabX1CMId8hLiaQal0g_al_eMJzQ-Q';

export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

export const APP_VERSION = '1.1.0-react';
