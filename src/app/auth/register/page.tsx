'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteAccountExists, setInviteAccountExists] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  // ANT-156: explicit consent to Terms + Privacy is required before we store
  // the email. Submit stays disabled until the box is checked.
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('invite')?.trim() ?? '';
    if (!token) return;

    setInviteToken(token);
    setInviteLoading(true);
    fetch(`/api/auth/register?invite=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error === 'invalid_invite'
            ? 'This invitation is invalid or expired.'
            : 'Could not read the invitation.');
          return;
        }
        setEmail(data.email);
        setInviteAccountExists(Boolean(data.account_exists));
      })
      .catch(() => setError('Could not read the invitation.'))
      .finally(() => setInviteLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Investigator email is required');
      return;
    }

    if (inviteToken) {
      if (inviteAccountExists) {
        setError('This email already has an account. Please sign in instead.');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    if (!consent) {
      setError('Please accept the Terms and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    try {
      if (inviteToken) {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteToken, password }),
        });

        const data = await res.json();
        if (res.ok) {
          router.replace('/sessions');
        } else {
          setError(data.message || data.error || 'Could not create the account.');
        }
        return;
      }

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
        {inviteToken ? (
          <>
            <div className="auth-stamp" style={{ top: 22, right: -6, transform: 'rotate(10deg)' }}>
              Cleared
              <small>Invite</small>
            </div>

            <div className="auth-card-hdr">
              <div className="auth-bureau-line">Miskatonic Bureau of Investigation</div>
              <h2>Create Your Account</h2>
              <p>Your waiting-list clearance is ready.</p>
            </div>

            {inviteLoading ? (
              <div className="auth-success">
                <span className="auth-success-glyph">…</span>
                <h2>Reading invitation</h2>
                <p>The Bureau is checking the seal on this letter.</p>
              </div>
            ) : inviteAccountExists ? (
              <div className="auth-success">
                <span className="auth-success-glyph">✓</span>
                <h2>Account already exists</h2>
                <p>
                  Access is open for <span className="auth-success-email">{email}</span>.
                </p>
                <p className="auth-waitlist-note">
                  Sign in with your existing credentials. If you forgot the password, use the reset link on the login page.
                </p>
                <div className="auth-foot">
                  <Link href="/auth/login">Access the archive</Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="auth-form">
                <div className="auth-field">
                  <label>Investigator ID</label>
                  <input
                    type="email"
                    value={email}
                    readOnly
                    autoComplete="email"
                  />
                </div>

                <div className="auth-field">
                  <label>Clearance Code</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                  />
                </div>

                <div className="auth-field">
                  <label>Repeat Clearance Code</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Confirm password"
                  />
                </div>

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

                <button
                  type="submit"
                  disabled={loading || !consent || inviteLoading}
                  className="auth-submit"
                >
                  <span>{loading ? 'Creating account...' : 'Create Account'}</span>
                  <span>→</span>
                </button>
              </form>
            )}
          </>
        ) : success ? (
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
