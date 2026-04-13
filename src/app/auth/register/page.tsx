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
          {success ? (
            <div className="px-8 py-10 text-center space-y-4">
              <div className="text-3xl">📜</div>
              <h2 className="text-amber-500 text-base tracking-wide">Check your email, Investigator</h2>
              <p className="text-stone-400 text-sm leading-relaxed">
                A message from the abyss has been sent to{' '}
                <span className="text-amber-400">{email}</span>.
                <br />
                Click the link inside to verify your identity.
              </p>
              <p className="text-stone-500 text-xs pt-2">
                Already verified?{' '}
                <Link href="/auth/login" className="text-amber-500 hover:text-amber-400 transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          ) : (
            <>
              <div className="px-8 py-6 border-b border-stone-800">
                <h2 className="text-stone-200 text-base tracking-wide">Begin Your Initiation</h2>
                <p className="text-stone-500 text-xs mt-1">Create an account to start your investigation</p>
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
                    autoComplete="new-password"
                    className="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-700 transition-colors"
                    placeholder="Min. 8 characters"
                  />
                </div>

                <div>
                  <label className="block text-stone-400 text-xs tracking-wide mb-1.5 uppercase">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="w-full bg-stone-800 border border-stone-700 text-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-700 transition-colors"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-xs">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-amber-800 hover:bg-amber-700 disabled:opacity-50 text-amber-100 rounded-lg py-2.5 text-sm tracking-wide transition-colors mt-2"
                >
                  {loading ? 'Initiating...' : 'Register'}
                </button>
              </form>

              <div className="px-8 pb-6 text-center">
                <p className="text-stone-500 text-xs">
                  Already initiated?{' '}
                  <Link href="/auth/login" className="text-amber-500 hover:text-amber-400 transition-colors">
                    Sign in
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
