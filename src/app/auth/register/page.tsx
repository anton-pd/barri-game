'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Lang = 'en' | 'uk';

export default function RegisterPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>('en');
  const [email, setEmail] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteAccountExists, setInviteAccountExists] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  // ANT-190: 'verify' = self-serve account created, confirmation email sent;
  // 'waitlist' = the legacy intake outcome.
  const [successMode, setSuccessMode] = useState<'waitlist' | 'verify'>('waitlist');
  // ANT-190: which intake the server is running. null = still asking.
  const [openMode, setOpenMode] = useState<boolean | null>(null);
  // ANT-156: explicit consent to Terms + Privacy is required before we store
  // the email. Submit stays disabled until the box is checked.
  const [consent, setConsent] = useState(false);

  const t = REGISTER_COPY[lang];
  const sc = successMode === 'verify' ? t.verify : t.success;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryLang = params.get('lang');
    if (queryLang === 'uk') setLang('uk');

    const token = params.get('invite')?.trim() ?? '';
    if (!token) {
      fetch('/api/auth/register')
        .then((res) => res.json())
        .then((data) => setOpenMode(Boolean(data.open)))
        .catch(() => setOpenMode(false));
      return;
    }

    setInviteToken(token);
    setInviteLoading(true);
    fetch(`/api/auth/register?invite=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error === 'invalid_invite' ? t.errors.inviteInvalid : t.errors.inviteReadFailed);
          return;
        }
        setEmail(data.email);
        setInviteAccountExists(Boolean(data.account_exists));
      })
      .catch(() => setError(t.errors.inviteReadFailed))
      .finally(() => setInviteLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError(t.errors.emailRequired);
      return;
    }

    if (inviteToken || openMode) {
      if (inviteToken && inviteAccountExists) {
        setError(t.errors.emailExists);
        return;
      }
      if (password.length < 8) {
        setError(t.errors.passwordTooShort);
        return;
      }
      if (password !== confirmPassword) {
        setError(t.errors.passwordsMismatch);
        return;
      }
    }

    if (!consent) {
      setError(t.errors.consentRequired);
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
          setError(data.message || data.error || t.errors.createAccountFailed);
        }
        return;
      }

      // ANT-190: self-serve account creation when registration is open.
      if (openMode) {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, locale: lang }),
        });

        const data = await res.json();
        if (res.ok) {
          setSuccessMode('verify');
          setSuccess(true);
        } else if (data.error === 'account_exists') {
          setError(t.errors.emailExists);
        } else {
          setError(data.message || data.error || t.errors.createAccountFailed);
        }
        return;
      }

      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'public-waitlist',
          locale: lang,
          outcome: 'requested-access',
          messageCount: 0,
          notes: 'Joined from public waitlist intake form.',
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || t.errors.fileRequestFailed);
      }
    } catch {
      setError(t.errors.connectionError);
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
        <span className="auth-caseno">{t.caseno}</span>
      </div>

      <div className="auth-card reveal d1">
        {inviteToken ? (
          <>
            <div className="auth-stamp" style={{ top: 22, right: -6, transform: 'rotate(10deg)' }}>
              {t.invite.stamp}
              <small>{t.invite.stampSmall}</small>
            </div>

            <div className="auth-card-hdr">
              <div className="auth-bureau-line">{t.bureauLine}</div>
              <h2>{t.invite.title}</h2>
              <p>{t.invite.subtitle}</p>
            </div>

            {inviteLoading ? (
              <div className="auth-success">
                <span className="auth-success-glyph">…</span>
                <h2>{t.invite.loadingTitle}</h2>
                <p>{t.invite.loadingBody}</p>
              </div>
            ) : inviteAccountExists ? (
              <div className="auth-success">
                <span className="auth-success-glyph">✓</span>
                <h2>{t.invite.existsTitle}</h2>
                <p>
                  {t.invite.existsBodyPrefix}
                  <span className="auth-success-email">{email}</span>
                </p>
                <p className="auth-waitlist-note">{t.invite.existsNote}</p>
                <div className="auth-foot">
                  <Link href="/auth/login">{t.footLink}</Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="auth-form">
                <div className="auth-field">
                  <label>{t.investigatorId}</label>
                  <input
                    type="email"
                    value={email}
                    readOnly
                    autoComplete="email"
                  />
                </div>

                <div className="auth-field">
                  <label>{t.invite.clearanceCode}</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder={t.invite.passwordPlaceholder}
                  />
                </div>

                <div className="auth-field">
                  <label>{t.invite.repeatClearanceCode}</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder={t.invite.confirmPasswordPlaceholder}
                  />
                </div>

                <label className="auth-consent">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>
                    {t.consent.prefix}
                    <Link href="/terms" target="_blank">{t.consent.terms}</Link>
                    {t.consent.mid}
                    <Link href="/privacy" target="_blank">{t.consent.privacy}</Link>
                    {t.consent.suffix}
                  </span>
                </label>

                {error && <div className="auth-error">{error}</div>}

                <button
                  type="submit"
                  disabled={loading || !consent || inviteLoading}
                  className="auth-submit"
                >
                  <span>{loading ? t.invite.submitLoading : t.invite.submit}</span>
                  <span>→</span>
                </button>
              </form>
            )}
          </>
        ) : success ? (
          <>
            <div className="auth-stamp" style={{ top: 22, right: -6, transform: 'rotate(8deg)' }}>
              {sc.stamp}
              <small>{sc.stampSmall}</small>
            </div>

            <div className="auth-card-hdr">
              <div className="auth-bureau-line">{t.bureauLine}</div>
              <h2>{sc.title}</h2>
              <p>{sc.subtitle}</p>
            </div>

            <div className="auth-success">
              <span className="auth-success-glyph">✉</span>
              <h2>{sc.title2}</h2>
              <p>
                {sc.bodyPrefix}
                <span className="auth-success-email">{email}</span>.
              </p>
              <p className="auth-waitlist-note">
                {sc.noteBefore}
                <strong>{sc.noteStrong}</strong>
                {sc.noteAfter}
              </p>
              <div className="auth-success-stamp">{sc.stamp2}</div>
            </div>

            <div className="auth-foot">
              {t.footPrefix}{' '}
              <Link href="/auth/login">{t.footLink}</Link>
            </div>
          </>
        ) : openMode === null ? (
          <div className="auth-success">
            <span className="auth-success-glyph">…</span>
          </div>
        ) : openMode ? (
          <>
            <div className="auth-stamp" style={{ top: 22, right: -6, transform: 'rotate(10deg)' }}>
              {t.open.stamp}
              <small>{t.open.stampSmall}</small>
            </div>

            <div className="auth-card-hdr">
              <div className="auth-bureau-line">{t.bureauLine}</div>
              <h2>{t.open.title}</h2>
              <p>{t.open.subtitle}</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label>{t.investigatorId}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="investigator@example.com"
                />
              </div>

              <div className="auth-field">
                <label>{t.invite.clearanceCode}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder={t.invite.passwordPlaceholder}
                />
              </div>

              <div className="auth-field">
                <label>{t.invite.repeatClearanceCode}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder={t.invite.confirmPasswordPlaceholder}
                />
              </div>

              <label className="auth-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  {t.consent.prefix}
                  <Link href="/terms" target="_blank">{t.consent.terms}</Link>
                  {t.consent.mid}
                  <Link href="/privacy" target="_blank">{t.consent.privacy}</Link>
                  {t.consent.suffix}
                </span>
              </label>

              {error && <div className="auth-error">{error}</div>}

              <button type="submit" disabled={loading || !consent} className="auth-submit">
                <span>{loading ? t.open.submitLoading : t.open.submit}</span>
                <span>→</span>
              </button>
            </form>

            <div className="auth-foot">
              {t.footPrefix}{' '}
              <Link href="/auth/login">{t.footLink}</Link>
            </div>
          </>
        ) : (
          <>
            <div className="auth-stamp" style={{ top: 22, right: -6, transform: 'rotate(10deg)' }}>
              {t.form.stamp}
              <small>{t.form.stampSmall}</small>
            </div>

            <div className="auth-card-hdr">
              <div className="auth-bureau-line">{t.bureauLine}</div>
              <h2>{t.form.title}</h2>
              <p>{t.form.subtitle}</p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label>{t.investigatorId}</label>
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
                {t.form.closedNote}
              </p>

              <label className="auth-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  {t.consent.prefix}
                  <Link href="/terms" target="_blank">{t.consent.terms}</Link>
                  {t.consent.mid}
                  <Link href="/privacy" target="_blank">{t.consent.privacy}</Link>
                  {t.consent.suffix}
                </span>
              </label>

              {error && <div className="auth-error">{error}</div>}

              <button type="submit" disabled={loading || !consent} className="auth-submit">
                <span>{loading ? t.form.submitLoading : t.form.submit}</span>
                <span>→</span>
              </button>
            </form>

            <div className="auth-foot">
              {t.footPrefix}{' '}
              <Link href="/auth/login">{t.footLink}</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const REGISTER_COPY = {
  en: {
    caseno: 'File · Auth/002',
    bureauLine: 'Miskatonic Bureau of Investigation',
    investigatorId: 'Investigator ID',
    footPrefix: 'Already cleared?',
    footLink: 'Access the archive',
    consent: {
      prefix: 'I am at least 16 and accept the ',
      terms: 'Terms',
      mid: ' and ',
      privacy: 'Privacy Policy',
      suffix: '.',
    },
    invite: {
      stamp: 'Cleared',
      stampSmall: 'Invite',
      title: 'Create Your Account',
      subtitle: 'Your waiting-list clearance is ready.',
      loadingTitle: 'Reading invitation',
      loadingBody: 'The Bureau is checking the seal on this letter.',
      existsTitle: 'Account already exists',
      existsBodyPrefix: 'Access is open for ',
      existsNote: 'Sign in with your existing credentials. If you forgot the password, use the reset link on the login page.',
      clearanceCode: 'Clearance Code',
      repeatClearanceCode: 'Repeat Clearance Code',
      passwordPlaceholder: 'At least 8 characters',
      confirmPasswordPlaceholder: 'Confirm password',
      submitLoading: 'Creating account...',
      submit: 'Create Account',
    },
    success: {
      stamp: 'Filed',
      stampSmall: 'Waiting List',
      title: 'Access Request Filed',
      subtitle: 'Your dossier is waiting for clearance.',
      title2: "You're on the waiting list",
      bodyPrefix: 'Your address has been filed as ',
      noteBefore: 'The Bureau admits investigators ',
      noteStrong: 'in controlled batches',
      noteAfter: ". We'll summon you when the next table opens.",
      stamp2: 'Waiting List',
    },
    open: {
      stamp: 'Enlist',
      stampSmall: 'Open Intake',
      title: 'Create Your Account',
      subtitle: 'The Bureau is recruiting. Investigator credentials are issued on the spot.',
      submitLoading: 'Creating account...',
      submit: 'Create Account',
    },
    verify: {
      stamp: 'Issued',
      stampSmall: 'Credentials',
      title: 'Account Created',
      subtitle: 'One seal is still missing.',
      title2: 'Confirm your address',
      bodyPrefix: 'A verification letter is on its way to ',
      noteBefore: 'Open the letter and ',
      noteStrong: 'confirm your email',
      noteAfter: ' — then sign in and open your first case.',
      stamp2: 'Verification Pending',
    },
    form: {
      stamp: 'Intake Form',
      stampSmall: 'New Recruit',
      title: 'Join the Waiting List',
      subtitle: 'Access opens in small batches. File your email for the next summons.',
      closedNote: 'Registration is closed during launch. The waiting list is the only intake route.',
      submitLoading: 'Filing request...',
      submit: 'Join Waiting List',
    },
    errors: {
      emailRequired: 'Investigator email is required',
      emailExists: 'This email already has an account. Please sign in instead.',
      passwordTooShort: 'Password must be at least 8 characters.',
      passwordsMismatch: 'Passwords do not match.',
      consentRequired: 'Please accept the Terms and Privacy Policy to continue.',
      createAccountFailed: 'Could not create the account.',
      connectionError: 'Connection error. Please try again.',
      fileRequestFailed: 'Could not file the request.',
      inviteInvalid: 'This invitation is invalid or expired.',
      inviteReadFailed: 'Could not read the invitation.',
    },
  },
  uk: {
    caseno: 'Файл · Авт/002',
    bureauLine: 'Бюро Розслідувань Містичних Справ',
    investigatorId: 'ID Слідчого',
    footPrefix: 'Вже маєте допуск?',
    footLink: 'Увійти до архіву',
    consent: {
      prefix: 'Мені виповнилось 16 і я приймаю ',
      terms: 'Умови використання',
      mid: ' та ',
      privacy: 'Політику конфіденційності',
      suffix: '.',
    },
    invite: {
      stamp: 'Допущено',
      stampSmall: 'Запрошення',
      title: 'Створити обліковий запис',
      subtitle: 'Ваш допуск зі списку очікування готовий.',
      loadingTitle: 'Читання запрошення',
      loadingBody: 'Бюро перевіряє печатку на цьому листі.',
      existsTitle: 'Обліковий запис вже існує',
      existsBodyPrefix: 'Доступ відкрито для ',
      existsNote: 'Увійдіть із наявними обліковими даними. Якщо забули пароль — скористайтесь посиланням для відновлення на сторінці входу.',
      clearanceCode: 'Код допуску',
      repeatClearanceCode: 'Повторіть код допуску',
      passwordPlaceholder: 'Щонайменше 8 символів',
      confirmPasswordPlaceholder: 'Підтвердіть пароль',
      submitLoading: 'Створення облікового запису...',
      submit: 'Створити обліковий запис',
    },
    success: {
      stamp: 'Подано',
      stampSmall: 'Список очікування',
      title: 'Заявку на доступ подано',
      subtitle: 'Ваше досьє очікує на допуск.',
      title2: 'Ви в списку очікування',
      bodyPrefix: 'Вашу адресу подано як ',
      noteBefore: 'Бюро приймає слідчих ',
      noteStrong: 'невеликими групами',
      noteAfter: '. Ми викличемо вас, щойно відкриється наступний стіл.',
      stamp2: 'Список очікування',
    },
    open: {
      stamp: 'Набір',
      stampSmall: 'Відкрито',
      title: 'Створити обліковий запис',
      subtitle: 'Бюро веде набір. Посвідчення слідчого видаємо одразу.',
      submitLoading: 'Створення облікового запису...',
      submit: 'Створити обліковий запис',
    },
    verify: {
      stamp: 'Видано',
      stampSmall: 'Посвідчення',
      title: 'Обліковий запис створено',
      subtitle: 'Бракує однієї печатки.',
      title2: 'Підтвердіть адресу',
      bodyPrefix: 'Лист із підтвердженням вже летить на ',
      noteBefore: 'Відкрийте лист і ',
      noteStrong: 'підтвердьте email',
      noteAfter: ' — після цього увійдіть і відкривайте першу справу.',
      stamp2: 'Очікує підтвердження',
    },
    form: {
      stamp: 'Форма Допуску',
      stampSmall: 'Новий Рекрут',
      title: 'Стати в чергу',
      subtitle: 'Доступ відкривається невеликими групами. Залиште свій email — ми надішлемо виклик.',
      closedNote: 'Реєстрація закрита під час запуску. Єдиний шлях — список очікування.',
      submitLoading: 'Подання заявки...',
      submit: 'Стати в чергу',
    },
    errors: {
      emailRequired: 'Необхідно вказати email слідчого',
      emailExists: 'На цю email-адресу вже зареєстровано обліковий запис. Будь ласка, увійдіть.',
      passwordTooShort: 'Пароль має містити щонайменше 8 символів.',
      passwordsMismatch: 'Паролі не збігаються.',
      consentRequired: 'Будь ласка, прийміть Умови використання та Політику конфіденційності, щоб продовжити.',
      createAccountFailed: 'Не вдалося створити обліковий запис.',
      connectionError: "Помилка з'єднання. Спробуйте ще раз.",
      fileRequestFailed: 'Не вдалося подати заявку.',
      inviteInvalid: 'Це запрошення недійсне або застаріло.',
      inviteReadFailed: 'Не вдалося прочитати запрошення.',
    },
  },
} as const;
