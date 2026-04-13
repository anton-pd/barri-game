'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  userId: string;
  currentRole: 'user' | 'admin';
}

export default function RoleToggle({ userId, currentRole }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="text-xs text-stone-500 hover:text-amber-500 disabled:opacity-50 transition-colors"
    >
      {currentRole === 'admin' ? 'Revoke admin' : 'Make admin'}
    </button>
  );
}
