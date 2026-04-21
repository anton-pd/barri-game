'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
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
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.status === 201) {
        setSuccess(true);
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <Link href="/" className="auth-back-brand">
          <span className="auth-seal">B</span>
          <span className="auth-wordmark">Barri</span>
        </Link>
        <span className="auth-caseno">File · Auth/002</span>
      </div>

      <div className="auth-card reveal d1">
        {success ? (
          <>
            <div className="auth-stamp" style={{ top: 22, right: -6, transform: 'rotate(8deg)' }}>
              Processed
              <small>Pending Verify</small>
            </div>

            <div className="auth-card-hdr">
              <div className="auth-bureau-line">Miskatonic Bureau of Investigation</div>
              <h2>New Recruit Intake</h2>
              <p>Application received and filed.</p>
            </div>

            <div className="auth-success">
              <span className="auth-success-glyph">✉</span>
              <h2>Check your post box, Investigator</h2>
              <p>
                A letter from the abyss has been dispatched to{' '}
                <span className="auth-success-email">{email}</span>.
              </p>
              <p>Click the enclosed link to verify your identity before the seal expires.</p>
              <div className="auth-success-stamp">Application Filed</div>
            </div>

            <div className="auth-foot">
              Already verified?{' '}
              <Link href="/auth/login">Access the archive</Link>
            </div>
          </>
        ) : (
          <>
            <div className="auth-stamp" style={{ top: 22, right: -6, transform: 'rotate(10deg)' }}>
              Intake Form
              <small>New Recruit</small>
            </div>

            <div className="auth-card-hdr">
              <div className="auth-bureau-line">Miskatonic Bureau of Investigation</div>
              <h2>Begin Your Initiation</h2>
              <p>Register to start your investigation.</p>
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
                <label>Clearance Code</label>
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
                <label>Confirm Code</label>
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
                <span>{loading ? 'Filing application...' : 'Submit for Initiation'}</span>
                <span>→</span>
              </button>
            </form>

            <div className="auth-foot">
              Already initiated?{' '}
              <Link href="/auth/login">Access the archive</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
