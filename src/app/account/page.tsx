'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import './account.css';
import { clearAllSessionCaches } from '@/lib/sessionCache';
import { InterfaceLanguageSelector } from '@/components/InterfaceLanguageSelector';
import { ACCOUNT_COPY } from '@/lib/appCopy';
import { normalizeInterfaceLanguage, type InterfaceLanguage } from '@/lib/interfaceLanguage';

// Account / privacy controls (ANT-159): GDPR data export (Art. 20) and
// self-service account deletion (Art. 17).
export default function AccountPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [interfaceLanguage, setInterfaceLanguage] = useState<InterfaceLanguage>('uk');
  const [languageStatus, setLanguageStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const c = ACCOUNT_COPY[interfaceLanguage];

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => {
        if (r.status === 401) { window.location.href = '/auth/login'; return null; }
        return r.json();
      })
      .then((d) => {
        if (d?.email) setEmail(d.email);
        setInterfaceLanguage(normalizeInterfaceLanguage(d?.interface_language));
      })
      .catch(() => {});
  }, []);

  async function handleLanguageChange(nextLanguage: InterfaceLanguage) {
    setInterfaceLanguage(nextLanguage);
    setLanguageStatus('saving');
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interface_language: nextLanguage }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json().catch(() => ({}));
      setInterfaceLanguage(normalizeInterfaceLanguage(data.interface_language));
      setLanguageStatus('saved');
      window.setTimeout(() => setLanguageStatus('idle'), 1600);
    } catch {
      setLanguageStatus('failed');
    }
  }

  async function handleDelete() {
    setError('');
    if (!password) { setError(c.passwordRequired); return; }
    setDeleting(true);
    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        clearAllSessionCaches();
        window.location.href = '/';
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(
        res.status === 403
          ? c.wrongPassword
          : data.error || c.deleteFailed
      );
    } catch {
      setError(c.networkError);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="account-root">
      <div className="account-wrap">
        <Link href="/sessions" className="account-back">← {c.back}</Link>

        <h1 className="account-h1">{c.title}</h1>
        <p className="account-email">{email ?? '…'}</p>

        <div className="account-card">
          <div className="account-card-header">
            <div>
              <h2>{c.languageTitle}</h2>
              <p>{c.languageBody}</p>
            </div>
            <span className={`account-save-state account-save-state--${languageStatus}`}>
              {languageStatus === 'saving' ? c.saving : languageStatus === 'saved' ? c.saved : languageStatus === 'failed' ? c.failed : ''}
            </span>
          </div>
          <InterfaceLanguageSelector
            value={interfaceLanguage}
            onChange={handleLanguageChange}
            className="account-lang-switcher"
            ariaLabel={c.languageTitle}
          />
        </div>

        <div className="account-card">
          <h2>{c.exportTitle}</h2>
          <p>{c.exportBody}</p>
          <a href="/api/account/export" className="account-btn" download>
            ⤓ {c.exportButton}
          </a>
        </div>

        <div className="account-card account-card--danger">
          <h2>{c.deleteTitle}</h2>
          <p>
            {c.deleteBody}
          </p>
          <button
            type="button"
            className="account-btn account-btn--danger"
            onClick={() => { setConfirming(true); setPassword(''); setError(''); }}
          >
            {c.deleteButton}
          </button>
        </div>
      </div>

      {confirming && (
        <div className="account-modal-scrim" onClick={() => !deleting && setConfirming(false)}>
          <div className="account-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{c.confirmTitle}</h3>
            <p>
              {c.confirmBody} <strong>{email}</strong> {c.confirmBodyAfter}
            </p>
            <label htmlFor="acc-del-pw">{c.password}</label>
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
                {c.cancel}
              </button>
              <button
                type="button"
                className="account-btn account-btn--danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? c.deleting : c.deleteForever}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
