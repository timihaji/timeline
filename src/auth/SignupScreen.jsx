import React, { useState } from 'react';
import { signUp } from './session.js';

export function SignupScreen({ onSwitchToLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const data = await signUp(email.trim(), password);
      // Supabase returns `session: null` when email confirmation is required.
      if (data?.session) {
        // Session is live; useSession() will pick it up.
      } else {
        setPendingConfirmation(true);
      }
    } catch (err) {
      setError(err?.message || 'Could not create account.');
    } finally {
      setSubmitting(false);
    }
  };

  if (pendingConfirmation) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1>Check your email</h1>
          <p className="auth-sub">
            We sent a confirmation link to <strong>{email}</strong>. Click it to
            activate your account, then come back and sign in.
          </p>
          <button type="button" className="auth-primary" onClick={onSwitchToLogin}>
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <h1>Create account</h1>
        <p className="auth-sub">Start with one workspace, free.</p>

        <label>
          <span>Email</span>
          <input type="email" autoComplete="email" required
            value={email} onChange={e => setEmail(e.target.value)} />
        </label>

        <label>
          <span>Password</span>
          <input type="password" autoComplete="new-password" required minLength={8}
            value={password} onChange={e => setPassword(e.target.value)} />
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="auth-primary" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>

        <div className="auth-links">
          <button type="button" className="auth-link" onClick={onSwitchToLogin}>
            Already have an account? Sign in
          </button>
        </div>
      </form>
    </div>
  );
}
