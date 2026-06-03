'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AccessStatus } from '@/types';

interface Props {
  userId: string;
  currentStatus: AccessStatus;
}

export default function AccessControl({ userId, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function setStatus(status: AccessStatus) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_status: status }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-3">
      {currentStatus !== 'approved' && (
        <button
          onClick={() => setStatus('approved')}
          disabled={loading}
          className="text-xs text-emerald-600 hover:text-emerald-400 disabled:opacity-50 transition-colors"
        >
          Approve
        </button>
      )}
      {currentStatus !== 'blocked' && (
        <button
          onClick={() => setStatus('blocked')}
          disabled={loading}
          className="text-xs text-stone-500 hover:text-red-400 disabled:opacity-50 transition-colors"
        >
          Block
        </button>
      )}
    </div>
  );
}
