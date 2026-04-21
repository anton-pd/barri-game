'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push('/auth/login'), 2500);
      } else if (data.error === 'invalid_token') {
        setError('This reset link has expired or is invalid. Request a new one.');
      } else {
        setError(data.error || 'Reset failed');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <>
        <div className="auth-card-hdr">
          <div className="auth-bureau-line">Miskatonic Bureau of Investigation</div>
          <h2>Invalid Link</h2>
          <p>No reset token found in this link.</p>
        </div>
        <div className="auth-error-state">
          <span className="auth-error-glyph">✗</span>
          <h2>The seal has been broken</h2>
          <p>This link is missing its authorisation token.</p>
          <p>Request a new reset letter from the login page.</p>
        </div>
        <div className="auth-foot">
          <Link href="/auth/forgot-password">Request new letter</Link>
        </div>
      </>
    );
  }

  if (success) {
    return (
      <>
        <div className="auth-card-hdr">
          <div className="auth-bureau-line">Miskatonic Bureau of Investigation</div>
          <h2>Code Updated</h2>
          <p>Your clearance code has been reset.</p>
        </div>
        <div className="auth-success">
          <span className="auth-success-glyph">✓</span>
          <h2>Clearance code updated</h2>
          <p>Your new code is now active.</p>
          <p>Redirecting to the archive entrance…</p>
          <div className="auth-success-stamp">Access Restored</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="auth-stamp" style={{ top: 22, right: -6, transform: 'rotate(10deg)' }}>
        Urgent
        <small>Reset Active</small>
      </div>

      <div className="auth-card-hdr">
        <div className="auth-bureau-line">Miskatonic Bureau of Investigation</div>
        <h2>Set New Clearance</h2>
        <p>Choose a new code for the Archive.</p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-field">
          <label>New Clearance Code</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="Min. 8 characters"
          />
        </div>

        <div className="auth-field">
          <label>Confirm New Code</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="••••••••"
          />
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" disabled={loading} className="auth-submit">
          <span>{loading ? 'Updating...' : 'Confirm New Code'}</span>
          <span>→</span>
        </button>
      </form>

      <div className="auth-foot">
        <Link href="/auth/login">Back to login</Link>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <Link href="/" className="auth-back-brand">
          <span className="auth-seal">B</span>
          <span className="auth-wordmark">Barri</span>
        </Link>
        <span className="auth-caseno">File · Auth/004</span>
      </div>

      <div className="auth-card reveal d1">
        <Suspense fallback={null}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
