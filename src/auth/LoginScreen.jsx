import React, { useState } from 'react';
import { signIn } from './session.js';

export function LoginScreen({ onSwitchToSignup, onSwitchToReset }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      // session listener in useSession() will pick up the new session and
      // re-render Root with <App/>.
    } catch (err) {
      setError(err?.message || 'Could not sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <h1>Timeline</h1>
        <p className="auth-sub">Sign in to your workspace</p>

        <label>
          <span>Email</span>
          <input type="email" autoComplete="email" required
            value={email} onChange={e => setEmail(e.target.value)} />
        </label>

        <label>
          <span>Password</span>
          <input type="password" autoComplete="current-password" required
            value={password} onChange={e => setPassword(e.target.value)} />
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="auth-primary" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="auth-links">
          <button type="button" className="auth-link" onClick={onSwitchToReset}>
            Forgot password?
          </button>
          <button type="button" className="auth-link" onClick={onSwitchToSignup}>
            Create account
          </button>
        </div>
      </form>
    </div>
  );
}
