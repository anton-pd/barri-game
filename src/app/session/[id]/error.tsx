'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function SessionError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('Session page unavailable', error.digest ?? 'no-digest');
  }, [error.digest]);

  return (
    <main className="session-unavailable" role="alert">
      <span className="session-unavailable-mark" aria-hidden="true">B</span>
      <h1>Справу тимчасово недоступно</h1>
      <p>Бюро не змогло завантажити матеріали. Спробуйте ще раз або поверніться до списку справ.</p>
      <div>
        <button type="button" onClick={() => unstable_retry()}>
          Спробувати ще раз
        </button>
        <Link href="/sessions">До списку справ</Link>
      </div>
    </main>
  );
}
