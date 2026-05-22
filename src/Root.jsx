import React from 'react';
import App from './App.jsx';
import { AuthGate } from './auth/AuthGate.jsx';
import './auth/auth.css';

// Phase 7 scaffolding: gate the app behind auth when Supabase is configured.
// When env vars are missing, AuthGate transparently renders <App/> so dev
// continues to work in file mode (Phase 8 will flip the persistence default).
// Phase 9 will branch here on `isShareRoute()` to render <ShareView/> for
// /s/<token> URLs without an auth requirement.

export function Root() {
  return (
    <AuthGate>
      <App />
    </AuthGate>
  );
}
