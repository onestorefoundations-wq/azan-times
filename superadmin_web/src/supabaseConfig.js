/**
 * supabaseConfig.js
 * Project coordinates, kept separate from supabaseClient so authSession can
 * import them without a module cycle.
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
