'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notVerified, setNotVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  // ANT-132: before hydration the submit button must stay disabled — a click
  // would fire a native GET submit that reloads the page and wipes both fields.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotVerified(false);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/sessions');
        router.refresh();
      } else if (data.error === 'email_not_verified') {
        setNotVerified(true);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendSent(false);
    try {
      await fetch('/api/auth/resend-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setResendSent(true);
    } catch {
      // silent
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <Link href="/" className="auth-back-brand">
          <span className="auth-seal">B</span>
          <span className="auth-wordmark">Barri</span>
        </Link>
        <span className="auth-caseno">File · Auth/001</span>
      </div>

      <div className="auth-card reveal d1">
        <div className="auth-stamp" style={{ top: 22, right: -6, transform: 'rotate(10deg)' }}>
          Restricted
          <small>Authorised Only</small>
        </div>

        <div className="auth-card-hdr">
          <div className="auth-bureau-line">Miskatonic Bureau of Investigation</div>
          <h2>Enter the Archive</h2>
          <p>Present your credentials to proceed.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>Investigator ID</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="investigator@example.com"
            />
          </div>

          <div className="auth-field">
            <div className="auth-field-labelrow">
              <label htmlFor="clearance-code">Clearance Code</label>
              <Link href="/auth/forgot-password" className="auth-forgot">Forgot code?</Link>
            </div>
            <input
              id="clearance-code"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          {notVerified && (
            <div className="auth-warning">
              <p>Identity not yet confirmed — check your post box for a verification letter.</p>
              {resendSent ? (
                <p>New letter dispatched.</p>
              ) : (
                <button type="button" onClick={handleResend} className="auth-warning-btn">
                  Dispatch new letter
                </button>
              )}
            </div>
          )}

          <button type="submit" disabled={loading || !hydrated} className="auth-submit">
            <span>{loading ? 'Verifying...' : 'Access Archive'}</span>
            <span>→</span>
          </button>
        </form>

        <div className="auth-foot">
          Need clearance?{' '}
          <Link href="/auth/register">Join the waiting list</Link>
        </div>
      </div>
    </div>
  );
}
