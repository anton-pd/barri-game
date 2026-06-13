import Link from "next/link";
import "../legal.css";

export const metadata = {
  title: "Terms of Service — Barri",
  description: "The terms governing your use of Barri.",
};

// ANT-156: terms of service scaffold. DRAFT — must be confirmed by counsel.
// Covers age requirement (ANT-158), AI-content nature (ANT-161), and acceptable
// use. Final wording pending legal review.
export default function TermsPage() {
  return (
    <div className="legal-root">
      <div className="legal-wrap">
        <Link href="/" className="legal-back">← Barri</Link>

        <div className="legal-draft">
          ⚠ DRAFT — pending legal review. This text is a structural placeholder
          and is not yet legally binding.
        </div>

        <h1 className="legal-h1">Terms of Service</h1>
        <p className="legal-updated">Last updated: 13 June 2026</p>

        <h2 className="legal-h2">1. Acceptance</h2>
        <p>
          By creating an account or joining the waiting list you agree to these
          Terms and to our <Link href="/privacy">Privacy Policy</Link>.
        </p>

        <h2 className="legal-h2">2. Minimum age</h2>
        <p>
          Barri contains horror and mature themes. You must be at least{" "}
          <strong>16 years old</strong> to use the service.
          <span className="legal-todo"> TODO: confirm minimum age and any
          parental-consent flow with counsel (ES digital-consent age is 14;
          ANT-158).</span>
        </p>

        <h2 className="legal-h2">3. The service is AI-generated</h2>
        <p>
          The Keeper, its narration, and any generated images are produced by
          artificial intelligence. Content is fictional and may be inaccurate or
          unexpected. It is provided for entertainment only.
        </p>

        <h2 className="legal-h2">4. Acceptable use</h2>
        <ul>
          <li>Do not use the service for unlawful purposes.</li>
          <li>Do not attempt to disrupt, abuse, or reverse-engineer the service.</li>
          <li>You are responsible for the content you submit.</li>
        </ul>

        <h2 className="legal-h2">5. Accounts</h2>
        <p>
          Keep your credentials secure. You may request deletion of your account
          at any time (see the <Link href="/privacy">Privacy Policy</Link>).
        </p>

        <h2 className="legal-h2">6. Availability &amp; changes</h2>
        <p>
          The service is provided &quot;as is&quot;. We may modify or discontinue
          features, and may update these Terms; material changes will be notified.
        </p>

        <h2 className="legal-h2">7. Contact</h2>
        <p>
          <a href="mailto:post@barrigame.es">post@barrigame.es</a>
        </p>

        <p style={{ marginTop: 40 }}>
          <Link href="/privacy">← Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
