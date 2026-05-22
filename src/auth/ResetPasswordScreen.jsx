import React, { useState } from 'react';
import { requestPasswordReset } from './session.js';

export function ResetPasswordScreen({ onSwitchToLogin }) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Could not send reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1>Check your email</h1>
          <p className="auth-sub">
            If an account exists for <strong>{email}</strong>, you'll get a
            password reset link shortly.
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
        <h1>Reset password</h1>
        <p className="auth-sub">Enter your email and we'll send a reset link.</p>

        <label>
          <span>Email</span>
          <input type="email" autoComplete="email" required
            value={email} onChange={e => setEmail(e.target.value)} />
        </label>

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" className="auth-primary" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>

        <div className="auth-links">
          <button type="button" className="auth-link" onClick={onSwitchToLogin}>
            Back to sign in
          </button>
        </div>
      </form>
    </div>
  );
}
