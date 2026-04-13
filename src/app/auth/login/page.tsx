'use client';

import { useState } from 'react';
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
        router.push('/');
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
    <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🐙</div>
          <h1 className="text-amber-500 text-xl tracking-widest uppercase font-normal">
            Call of Cthulhu
          </h1>
          <p className="text-stone-500 text-xs italic tracking-widest mt-1">
            Ph&apos;nglui mglw&apos;nafh Cthulhu R&apos;lyeh wgah&apos;nagl fhtagn
          </p>
        </div>

        {/* Card */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden">
          <div className="px-8 py-6 border-b border-stone-800">
            <h2 className="text-stone-200 text-base tracking-wide">Enter the Archive</h2>
            <p className="text-stone-500 text-xs mt-1">Sign in to continue your investigation</p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
            <div>
              <label className="block text-stone-400 text-xs tracking-wide mb-1.5 uppercase">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-700 transition-colors"
                placeholder="investigator@example.com"
              />
            </div>

            <div>
              <label className="block text-stone-400 text-xs tracking-wide mb-1.5 uppercase">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-700 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs">{error}</p>
            )}

            {notVerified && (
              <div className="bg-stone-800 border border-amber-900/50 rounded-lg p-3 space-y-2">
                <p className="text-amber-400 text-xs">
                  Your email has not been verified yet. Check your inbox or request a new link.
                </p>
                {resendSent ? (
                  <p className="text-stone-400 text-xs">Verification email sent.</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    className="text-amber-500 text-xs underline underline-offset-2 hover:text-amber-400"
                  >
                    Resend verification email
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-800 hover:bg-amber-700 disabled:opacity-50 text-amber-100 rounded-lg py-2.5 text-sm tracking-wide transition-colors mt-2"
            >
              {loading ? 'Entering...' : 'Enter'}
            </button>
          </form>

          <div className="px-8 pb-6 text-center">
            <p className="text-stone-500 text-xs">
              Not yet initiated?{' '}
              <Link href="/auth/register" className="text-amber-500 hover:text-amber-400 transition-colors">
                Register
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
