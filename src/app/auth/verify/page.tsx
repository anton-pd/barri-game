import Link from 'next/link';

interface PageProps {
  searchParams: Promise<{ error?: string; token?: string }>;
}

export default async function VerifyPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <Link href="/" className="auth-back-brand">
          <span className="auth-seal">B</span>
          <span className="auth-wordmark">Barri</span>
        </Link>
        <span className="auth-caseno">File · Auth/003</span>
      </div>

      <div className="auth-card reveal d1">
        {error === 'invalid' ? (
          <>
            <div className="auth-stamp" style={{ top: 22, right: -6, transform: 'rotate(9deg)' }}>
              Void
              <small>Seal Broken</small>
            </div>

            <div className="auth-card-hdr">
              <div className="auth-bureau-line">Miskatonic Bureau of Investigation</div>
              <h2>Verification Failed</h2>
              <p>The link has been compromised or has expired.</p>
            </div>

            <div className="auth-error-state">
              <span className="auth-error-glyph">✗</span>
              <h2>The seal has been broken</h2>
              <p>This verification link is invalid or has expired.</p>
              <p>Tokens are valid for 24 hours only.</p>
            </div>

            <div className="auth-foot">
              <Link href="/auth/login">Return to login</Link>
              {' '}— request a new link from there.
            </div>
          </>
        ) : (
          <>
            <div className="auth-stamp" style={{ top: 22, right: -6, transform: 'rotate(8deg)' }}>
              Pending
              <small>Awaiting Verify</small>
            </div>

            <div className="auth-card-hdr">
              <div className="auth-bureau-line">Miskatonic Bureau of Investigation</div>
              <h2>Identity Verification</h2>
              <p>Awaiting confirmation from the post.</p>
            </div>

            <div className="auth-success">
              <span className="auth-success-glyph">✉</span>
              <h2>Check your post box</h2>
              <p>A verification letter has been dispatched to your address.</p>
              <p>The enclosed link expires in 24 hours.</p>
            </div>

            <div className="auth-foot">
              <Link href="/auth/login">Back to login</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
