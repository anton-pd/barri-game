import { Resend } from 'resend';

let resendClient: Resend | null = null;

function getClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY env var is not set');
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export function getEmailSender(): string {
  return process.env.RESEND_FROM ?? 'Barri Bureau <noreply@barrigame.es>';
}

const APP_URL = () => process.env.APP_URL ?? 'http://localhost:3000';

type InviteLocale = 'en' | 'uk' | 'es';

function normalizeInviteLocale(locale?: string | null): InviteLocale {
  if (locale === 'uk' || locale === 'es') return locale;
  return 'en';
}

function noirEmailHtml(opts: {
  fileRef: string;
  stamp: string;
  stampSub: string;
  heading: string;
  subheading: string;
  bodyHtml: string;
  ctaHref: string;
  ctaLabel: string;
  fallbackUrl: string;
  expiry: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background-color:#07060a;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#07060a;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background-color:#c3b088;max-width:520px;width:100%;">

          <!-- DARK HEADER BAR -->
          <tr>
            <td style="background-color:#07060a;padding:12px 32px;border-bottom:1px solid #3a2e1e;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.38em;text-transform:uppercase;color:#6b5a3e;">
                    Miskatonic Bureau of Investigation
                  </td>
                  <td align="right" style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:#6b5a3e;">
                    ${opts.fileRef}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CARD HEADER -->
          <tr>
            <td style="padding:26px 36px 20px;border-bottom:1px dashed #6b5a3e;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="top">
                    <div style="font-family:Georgia,serif;font-weight:bold;font-size:30px;color:#0d0b10;line-height:1;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px;">
                      BARRI
                    </div>
                    <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:#6b5a3e;margin-bottom:4px;">
                      ${opts.heading}
                    </div>
                    <div style="font-family:Georgia,serif;font-style:italic;font-size:13px;color:#a8936a;">
                      ${opts.subheading}
                    </div>
                  </td>
                  <td align="right" valign="top" style="padding-left:16px;">
                    <div style="border:2.5px solid #8b1a14;color:#8b1a14;font-family:Georgia,serif;font-weight:bold;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;padding:7px 10px 5px;line-height:1;white-space:nowrap;">
                      ${opts.stamp}
                      <div style="font-family:'Courier New',monospace;font-size:8px;letter-spacing:0.2em;font-weight:normal;margin-top:3px;">
                        ${opts.stampSub}
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:28px 36px 24px;">
              ${opts.bodyHtml}

              <!-- CTA BUTTON -->
              <table cellpadding="0" cellspacing="0" style="margin:28px auto;">
                <tr>
                  <td style="background-color:#0d0b10;border-bottom:5px solid #8b1a14;border-right:5px solid #8b1a14;">
                    <a href="${opts.ctaHref}"
                       style="display:block;padding:16px 36px;font-family:'Courier New',monospace;font-size:12px;letter-spacing:0.32em;text-transform:uppercase;color:#d8c8a6;text-decoration:none;white-space:nowrap;">
                      ${opts.ctaLabel} &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#6b5a3e;text-align:center;">
                ${opts.expiry}
              </p>
              <p style="margin:0;font-family:'Courier New',monospace;font-size:9px;color:#a8936a;text-align:center;word-break:break-all;line-height:1.5;">
                ${opts.fallbackUrl}
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:14px 36px 18px;border-top:1px dashed #6b5a3e;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Georgia,serif;font-style:italic;font-size:11px;color:#6b5a3e;">
                    Ph&rsquo;nglui mglw&rsquo;nafh Cthulhu R&rsquo;lyeh wgah&rsquo;nagl fhtagn
                  </td>
                  <td align="right" style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#a8936a;">
                    barrigame.es
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendVerificationEmail(opts: { to: string; token: string }): Promise<void> {
  const verifyLink = `${APP_URL()}/api/auth/verify?token=${opts.token}`;

  const bodyHtml = `
    <p style="margin:0 0 16px;font-family:Georgia,serif;font-style:italic;font-size:15px;color:#14111a;line-height:1.6;">
      Investigator,
    </p>
    <p style="margin:0;font-family:Georgia,serif;font-style:italic;font-size:15px;color:#1c1824;line-height:1.65;">
      A communiqu&eacute; from the Bureau. To complete your initiation into the Archive, you must
      confirm your identity. Present the seal below — it expires in 24 hours.
    </p>`;

  const html = noirEmailHtml({
    fileRef: 'File: Auth/001',
    stamp: 'Restricted',
    stampSub: 'Verify Identity',
    heading: 'Identity Verification Required',
    subheading: 'New recruit intake — confirm your address',
    bodyHtml,
    ctaHref: verifyLink,
    ctaLabel: 'Verify Your Identity',
    fallbackUrl: verifyLink,
    expiry: 'This seal expires in 24 hours',
  });

  const text = `Investigator,\n\nVerify your email address by visiting this link:\n${verifyLink}\n\nThis link expires in 24 hours.\n\n— Barri Bureau`;

  await getClient().emails.send({
    from: getEmailSender(),
    to: opts.to,
    subject: 'Verify your identity — Barri Bureau',
    html,
    text,
  });
}

export async function sendPasswordResetEmail(opts: { to: string; token: string }): Promise<void> {
  const resetLink = `${APP_URL()}/auth/reset-password?token=${opts.token}`;

  const bodyHtml = `
    <p style="margin:0 0 16px;font-family:Georgia,serif;font-style:italic;font-size:15px;color:#14111a;line-height:1.6;">
      Investigator,
    </p>
    <p style="margin:0 0 20px;font-family:Georgia,serif;font-style:italic;font-size:15px;color:#1c1824;line-height:1.65;">
      A request to reset your clearance code has been received at the Bureau.
      Click the seal below to proceed. This authorisation expires in <strong style="font-style:normal;">1 hour</strong>.
    </p>
    <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#6b5a3e;border-left:2px solid #8b1a14;padding-left:12px;">
      If you did not request this, disregard this letter — your credentials remain unchanged.
    </p>`;

  const html = noirEmailHtml({
    fileRef: 'File: Auth/004',
    stamp: 'Urgent',
    stampSub: 'Reset Request',
    heading: 'Clearance Code Reset',
    subheading: 'Authorised reset — valid for 1 hour only',
    bodyHtml,
    ctaHref: resetLink,
    ctaLabel: 'Reset Clearance Code',
    fallbackUrl: resetLink,
    expiry: 'This authorisation expires in 1 hour',
  });

  const text = `Investigator,\n\nReset your clearance code by visiting this link:\n${resetLink}\n\nThis link expires in 1 hour.\n\nIf you did not request this, ignore this message.\n\n— Barri Bureau`;

  await getClient().emails.send({
    from: getEmailSender(),
    to: opts.to,
    subject: 'Reset your clearance code — Barri Bureau',
    html,
    text,
  });
}

const accessInviteCopy: Record<InviteLocale, {
  subjectNew: string;
  subjectExisting: string;
  heading: string;
  subheadingNew: string;
  subheadingExisting: string;
  greeting: string;
  bodyNew: string;
  bodyExisting: string;
  note: string;
  ctaNew: string;
  ctaExisting: string;
  expiryNew: string;
  expiryExisting: string;
}> = {
  en: {
    subjectNew: 'Your Barri access is open — create your account',
    subjectExisting: 'Your Barri access is open',
    heading: 'Access Clearance Granted',
    subheadingNew: 'Your dossier has cleared the waiting list',
    subheadingExisting: 'Your existing account has been cleared for play',
    greeting: 'Investigator,',
    bodyNew: 'Your place on the waiting list has been called. Create your Barri account, set your clearance code, and enter the case archive.',
    bodyExisting: 'Your existing Barri account has been cleared. Sign in with your account credentials and continue to the case archive.',
    note: 'If the button does not open, copy the link below into your browser.',
    ctaNew: 'Create Account',
    ctaExisting: 'Enter Barri',
    expiryNew: 'This invitation seal expires in 14 days',
    expiryExisting: 'Your clearance is active now',
  },
  uk: {
    subjectNew: 'Ваш доступ до Barri відкрито — створіть акаунт',
    subjectExisting: 'Ваш доступ до Barri відкрито',
    heading: 'Доступ відкрито',
    subheadingNew: 'Вашу справу знято зі списку очікування',
    subheadingExisting: 'Ваш наявний акаунт допущено до гри',
    greeting: 'Слідчий,',
    bodyNew: 'Ваша черга зі списку очікування настала. Створіть акаунт Barri, задайте пароль доступу й заходьте до архіву справ.',
    bodyExisting: 'Ваш наявний акаунт Barri отримав доступ. Увійдіть зі своїми обліковими даними й продовжуйте до архіву справ.',
    note: 'Якщо кнопка не відкривається, скопіюйте посилання нижче у браузер.',
    ctaNew: 'Створити акаунт',
    ctaExisting: 'Увійти в Barri',
    expiryNew: 'Це запрошення діє 14 днів',
    expiryExisting: 'Ваш доступ уже активний',
  },
  es: {
    subjectNew: 'Tu acceso a Barri está abierto — crea tu cuenta',
    subjectExisting: 'Tu acceso a Barri está abierto',
    heading: 'Acceso concedido',
    subheadingNew: 'Tu expediente salió de la lista de espera',
    subheadingExisting: 'Tu cuenta existente ya tiene acceso',
    greeting: 'Investigador,',
    bodyNew: 'Ha llegado tu turno en la lista de espera. Crea tu cuenta de Barri, elige tu contraseña de acceso y entra al archivo de casos.',
    bodyExisting: 'Tu cuenta existente de Barri ya tiene acceso. Inicia sesión con tus credenciales y entra al archivo de casos.',
    note: 'Si el botón no se abre, copia el enlace de abajo en tu navegador.',
    ctaNew: 'Crear cuenta',
    ctaExisting: 'Entrar en Barri',
    expiryNew: 'Esta invitación expira en 14 días',
    expiryExisting: 'Tu acceso ya está activo',
  },
};

export function buildAccessInviteEmail(opts: {
  to: string;
  locale?: string | null;
  inviteToken?: string | null;
  existingAccount?: boolean;
}): { subject: string; html: string; text: string; href: string; locale: InviteLocale } {
  const locale = normalizeInviteLocale(opts.locale);
  const copy = accessInviteCopy[locale];
  const existingAccount = opts.existingAccount === true || !opts.inviteToken;
  const href = existingAccount
    ? `${APP_URL()}/auth/login`
    : `${APP_URL()}/auth/register?invite=${opts.inviteToken}`;

  const bodyHtml = `
    <p style="margin:0 0 16px;font-family:Georgia,serif;font-style:italic;font-size:15px;color:#14111a;line-height:1.6;">
      ${copy.greeting}
    </p>
    <p style="margin:0 0 18px;font-family:Georgia,serif;font-style:italic;font-size:15px;color:#1c1824;line-height:1.65;">
      ${existingAccount ? copy.bodyExisting : copy.bodyNew}
    </p>
    <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#6b5a3e;border-left:2px solid #8b1a14;padding-left:12px;line-height:1.7;">
      ${copy.note}
    </p>`;

  const html = noirEmailHtml({
    fileRef: 'File: Access/180',
    stamp: existingAccount ? 'Cleared' : 'Summoned',
    stampSub: existingAccount ? 'Access Open' : 'Invite',
    heading: copy.heading,
    subheading: existingAccount ? copy.subheadingExisting : copy.subheadingNew,
    bodyHtml,
    ctaHref: href,
    ctaLabel: existingAccount ? copy.ctaExisting : copy.ctaNew,
    fallbackUrl: href,
    expiry: existingAccount ? copy.expiryExisting : copy.expiryNew,
  });

  const text = [
    copy.greeting,
    '',
    existingAccount ? copy.bodyExisting : copy.bodyNew,
    '',
    `${existingAccount ? copy.ctaExisting : copy.ctaNew}: ${href}`,
    '',
    existingAccount ? copy.expiryExisting : copy.expiryNew,
    '',
    '— Barri Bureau',
  ].join('\n');

  return {
    subject: existingAccount ? copy.subjectExisting : copy.subjectNew,
    html,
    text,
    href,
    locale,
  };
}

export async function sendAccessInviteEmail(opts: {
  to: string;
  locale?: string | null;
  inviteToken?: string | null;
  existingAccount?: boolean;
}): Promise<void> {
  const email = buildAccessInviteEmail(opts);
  await getClient().emails.send({
    from: getEmailSender(),
    to: opts.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}
