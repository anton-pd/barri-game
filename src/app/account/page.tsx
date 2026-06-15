'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import './account.css';

// Account / privacy controls (ANT-159): GDPR data export (Art. 20) and
// self-service account deletion (Art. 17).
export default function AccountPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => {
        if (r.status === 401) { window.location.href = '/auth/login'; return null; }
        return r.json();
      })
      .then((d) => { if (d?.email) setEmail(d.email); })
      .catch(() => {});
  }, []);

  async function handleDelete() {
    setError('');
    if (!password) { setError('Введіть пароль для підтвердження.'); return; }
    setDeleting(true);
    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = '/';
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(
        res.status === 403
          ? 'Невірний пароль.'
          : data.error || 'Не вдалося видалити акаунт.'
      );
    } catch {
      setError('Помилка зʼєднання. Спробуйте ще раз.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="account-root">
      <div className="account-wrap">
        <Link href="/sessions" className="account-back">← Сесії</Link>

        <h1 className="account-h1">Дані та приватність</h1>
        <p className="account-email">{email ?? '…'}</p>

        <div className="account-card">
          <h2>Завантажити мої дані</h2>
          <p>
            Вивантажити всі дані, повʼязані з акаунтом (профіль, сесії,
            повідомлення, кампанії, відгуки) одним файлом JSON.
          </p>
          <a href="/api/account/export" className="account-btn" download>
            ⤓ Завантажити JSON
          </a>
        </div>

        <div className="account-card account-card--danger">
          <h2>Видалити акаунт</h2>
          <p>
            Назавжди видаляє ваш акаунт і всі повʼязані дані (сесії, повідомлення,
            кампанії). Дію <strong>не можна скасувати</strong>.
          </p>
          <button
            type="button"
            className="account-btn account-btn--danger"
            onClick={() => { setConfirming(true); setPassword(''); setError(''); }}
          >
            Видалити акаунт
          </button>
        </div>
      </div>

      {confirming && (
        <div className="account-modal-scrim" onClick={() => !deleting && setConfirming(false)}>
          <div className="account-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Підтвердіть видалення</h3>
            <p>
              Це назавжди видалить акаунт <strong>{email}</strong> і всі дані.
              Введіть пароль, щоб підтвердити.
            </p>
            <label htmlFor="acc-del-pw">Пароль</label>
            <input
              id="acc-del-pw"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleDelete(); }}
            />
            {error && <div className="account-modal-error">{error}</div>}
            <div className="account-modal-actions">
              <button
                type="button"
                className="account-btn"
                onClick={() => setConfirming(false)}
                disabled={deleting}
              >
                Скасувати
              </button>
              <button
                type="button"
                className="account-btn account-btn--danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Видалення…' : 'Видалити назавжди'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
