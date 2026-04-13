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

export async function sendVerificationEmail(opts: { to: string; token: string }): Promise<void> {
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const verifyLink = `${appUrl}/api/auth/verify?token=${opts.token}`;
  const from = process.env.RESEND_FROM ?? 'Call of Cthulhu Keeper <noreply@barrigame.es>';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#0c0a09;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0c0a09;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#1c1917;border:1px solid #292524;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #292524;text-align:center;">
              <div style="font-size:32px;margin-bottom:8px;">🐙</div>
              <h1 style="margin:0;font-size:20px;color:#f59e0b;letter-spacing:0.05em;font-weight:normal;">
                CALL OF CTHULHU
              </h1>
              <p style="margin:4px 0 0;font-size:12px;color:#57534e;font-style:italic;letter-spacing:0.1em;">
                AI Keeper
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 16px;font-size:15px;color:#e7e5e4;line-height:1.6;">
                Investigator,
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#a8a29e;line-height:1.6;">
                A message has arrived from the depths. To complete your initiation into the mysteries,
                you must verify your identity. Click the seal below to confirm your email address.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:8px;background-color:#92400e;">
                    <a href="${verifyLink}"
                       style="display:inline-block;padding:14px 32px;font-size:14px;color:#fef3c7;text-decoration:none;letter-spacing:0.05em;font-family:Georgia,serif;">
                      Verify Your Identity
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:12px;color:#57534e;text-align:center;">
                This seal expires in 24 hours.
              </p>
              <p style="margin:0;font-size:11px;color:#44403c;text-align:center;word-break:break-all;">
                ${verifyLink}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #292524;text-align:center;">
              <p style="margin:0;font-size:11px;color:#44403c;font-style:italic;">
                Ph'nglui mglw'nafh Cthulhu R'lyeh wgah'nagl fhtagn
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Investigator,\n\nVerify your email address by visiting this link:\n${verifyLink}\n\nThis link expires in 24 hours.\n\n— Call of Cthulhu AI Keeper`;

  await getClient().emails.send({
    from,
    to: opts.to,
    subject: 'Verify your identity — Call of Cthulhu AI Keeper',
    html,
    text,
  });
}
