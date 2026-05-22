import React, { useState } from 'react';
import { useSession } from './session.js';
import { LoginScreen } from './LoginScreen.jsx';
import { SignupScreen } from './SignupScreen.jsx';
import { ResetPasswordScreen } from './ResetPasswordScreen.jsx';

/**
 * Gate component. Renders the auth screens when Supabase is configured and no
 * session exists. Passes children through transparently when:
 *   - Supabase env vars are missing (dev fallback to file mode)
 *   - A session is active (post-login)
 */
export function AuthGate({ children }) {
  const session = useSession();
  const [screen, setScreen] = useState('login'); // 'login' | 'signup' | 'reset'

  // Fallback path: no env vars, run app as if auth doesn't exist.
  if (session === 'unconfigured') return children;

  if (session === 'loading') {
    return <div className="auth-screen"><div className="auth-loading">Loading…</div></div>;
  }

  if (!session) {
    if (screen === 'signup') {
      return <SignupScreen onSwitchToLogin={() => setScreen('login')} />;
    }
    if (screen === 'reset') {
      return <ResetPasswordScreen onSwitchToLogin={() => setScreen('login')} />;
    }
    return (
      <LoginScreen
        onSwitchToSignup={() => setScreen('signup')}
        onSwitchToReset={() => setScreen('reset')}
      />
    );
  }

  return children;
}
