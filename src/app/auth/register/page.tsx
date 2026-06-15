'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  // ANT-156: explicit consent to Terms + Privacy is required before we store
  // the email. Submit stays disabled until the box is checked.
  const [consent, setConsent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Investigator email is required');
      return;
    }

    if (!consent) {
      setError('Please accept the Terms and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'public-waitlist',
          locale: 'en',
          outcome: 'requested-access',
          messageCount: 0,
          notes: 'Joined from public waitlist intake form.',
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || 'Could not file the request.');
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
              Filed
              <small>Waiting List</small>
            </div>

            <div className="auth-card-hdr">
              <div className="auth-bureau-line">Miskatonic Bureau of Investigation</div>
              <h2>Access Request Filed</h2>
              <p>Your dossier is waiting for clearance.</p>
            </div>

            <div className="auth-success">
              <span className="auth-success-glyph">✉</span>
              <h2>You&apos;re on the waiting list</h2>
              <p>
                Your address has been filed as{' '}
                <span className="auth-success-email">{email}</span>.
              </p>
              <p className="auth-waitlist-note">
                The Bureau admits investigators <strong>in controlled batches</strong>. We&apos;ll
                summon you when the next table opens.
              </p>
              <div className="auth-success-stamp">Waiting List</div>
            </div>

            <div className="auth-foot">
              Already cleared?{' '}
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
              <h2>Join the Waiting List</h2>
              <p>Access opens in small batches. File your email for the next summons.</p>
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

              <p className="auth-waitlist-note auth-waitlist-note--form">
                Registration is closed during launch. The waiting list is the only intake route.
              </p>

              <label className="auth-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  I am at least 16 and accept the{' '}
                  <Link href="/terms" target="_blank">Terms</Link> and{' '}
                  <Link href="/privacy" target="_blank">Privacy Policy</Link>.
                </span>
              </label>

              {error && <div className="auth-error">{error}</div>}

              <button type="submit" disabled={loading || !consent} className="auth-submit">
                <span>{loading ? 'Filing request...' : 'Join Waiting List'}</span>
                <span>→</span>
              </button>
            </form>

            <div className="auth-foot">
              Already cleared?{' '}
              <Link href="/auth/login">Access the archive</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
