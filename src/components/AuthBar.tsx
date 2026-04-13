'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface UserInfo {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

export default function AuthBar() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setUser(data))
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/auth/login');
    router.refresh();
  }

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      {user.role === 'admin' && (
        <Link
          href="/admin"
          className="text-amber-600 hover:text-amber-500 text-xs tracking-wide transition-colors"
        >
          Admin
        </Link>
      )}
      <span className="text-stone-600 text-xs">{user.email}</span>
      <button
        onClick={handleLogout}
        className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
