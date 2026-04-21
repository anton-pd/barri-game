'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch {
      // Show success anyway — no enumeration
      setSubmitted(true);
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
        <span className="auth-caseno">File · Auth/003</span>
      </div>

      <div className="auth-card reveal d1">
        <div className="auth-stamp" style={{ top: 22, right: -6, transform: 'rotate(10deg)' }}>
          Recall
          <small>Code Request</small>
        </div>

        <div className="auth-card-hdr">
          <div className="auth-bureau-line">Miskatonic Bureau of Investigation</div>
          <h2>Recover Clearance</h2>
          <p>Provide your ID — we&apos;ll dispatch a reset letter.</p>
        </div>

        {submitted ? (
          <div className="auth-success">
            <span className="auth-success-glyph">✉</span>
            <h2>Letter dispatched</h2>
            <p>
              If that address is on file, a reset letter has been sent.
              Check your post box and follow the enclosed link.
            </p>
            <p style={{ marginTop: 8 }}>The link expires in 1 hour.</p>
          </div>
        ) : (
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

            <button type="submit" disabled={loading} className="auth-submit">
              <span>{loading ? 'Dispatching...' : 'Send Reset Letter'}</span>
              <span>→</span>
            </button>
          </form>
        )}

        <div className="auth-foot">
          Remembered your code?{' '}
          <Link href="/auth/login">Access the archive</Link>
        </div>
      </div>
    </div>
  );
}
