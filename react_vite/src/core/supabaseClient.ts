/**
 * supabaseClient.ts
 * Shared Supabase client. URL + anon key are the SAME as the Flutter app
 * (flutter_app/lib/core/supabase_sync_service.dart) so both clients talk to
 * the same project and interoperate.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://veyrcvvvsomyrahjfvhh.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleXJjdnZ2c29teXJhaGpmdmhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjI5MzUsImV4cCI6MjA5NzMzODkzNX0.-N470V130EwnrJabX1CMId8hLiaQal0g_al_eMJzQ-Q';

export const APP_VERSION = '1.0.0-react';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
