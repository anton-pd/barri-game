import Link from 'next/link';

interface PageProps {
  searchParams: Promise<{ error?: string; token?: string }>;
}

export default async function VerifyPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🐙</div>
          <h1 className="text-amber-500 text-xl tracking-widest uppercase font-normal">
            Call of Cthulhu
          </h1>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl px-8 py-10 text-center space-y-4">
          {error === 'invalid' ? (
            <>
              <div className="text-3xl">💀</div>
              <h2 className="text-red-400 text-base tracking-wide">The seal has been broken</h2>
              <p className="text-stone-400 text-sm leading-relaxed">
                This verification link is invalid or has expired.
                <br />
                Tokens are valid for 24 hours.
              </p>
              <div className="pt-2 space-y-2">
                <p className="text-stone-500 text-xs">
                  <Link href="/auth/login" className="text-amber-500 hover:text-amber-400 transition-colors">
                    Return to login
                  </Link>
                  {' — '}you can request a new link from there.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="text-3xl">📬</div>
              <h2 className="text-amber-500 text-base tracking-wide">Awaiting verification</h2>
              <p className="text-stone-400 text-sm leading-relaxed">
                Check your email for a verification link.
                <br />
                The link expires in 24 hours.
              </p>
              <p className="text-stone-500 text-xs pt-2">
                <Link href="/auth/login" className="text-amber-500 hover:text-amber-400 transition-colors">
                  Back to login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
