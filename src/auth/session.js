// Session management — thin wrapper around supabase.auth so the React layer
// doesn't need to know about the SDK shape. Safe to call even when Supabase
// is not configured; the hook returns 'unconfigured' and the auth functions
// throw `supabase_not_configured`.

import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../persistence/supabase.js';

/**
 * React hook returning the current auth state.
 * @returns {'loading' | 'unconfigured' | null | { user, ... }}
 *   - 'loading'      → initial check in flight
 *   - 'unconfigured' → no env vars; caller should fall back to file mode
 *   - null           → no active session; caller should show LoginScreen
 *   - session object → user is signed in
 */
export function useSession() {
  const [session, setSession] = useState(() =>
    isSupabaseConfigured() ? 'loading' : 'unconfigured'
  );

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setSession(data.session || null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!cancelled) setSession(s || null);
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  return session;
}

function requireClient() {
  if (!isSupabaseConfigured()) {
    const err = new Error('supabase_not_configured');
    err.code = 'supabase_not_configured';
    throw err;
  }
  return supabase;
}

export async function signUp(email, password) {
  const client = requireClient();
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const client = requireClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const client = requireClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email) {
  const client = requireClient();
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password',
  });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const client = requireClient();
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
