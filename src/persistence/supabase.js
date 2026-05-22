// Supabase client singleton. Reads credentials from Vite-exposed env vars; if
// either is missing the client is null and `isSupabaseConfigured()` returns
// false. Callers must check before using the client — see src/auth/session.js
// for the canonical pattern.

import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _client = null;

if (URL && ANON_KEY) {
  _client = createClient(URL, ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase = _client;

/**
 * @returns {boolean} true when both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
 * are set at build/dev time. Cached at module load — restart the dev server
 * after changing .env.
 */
export function isSupabaseConfigured() {
  return _client !== null;
}
