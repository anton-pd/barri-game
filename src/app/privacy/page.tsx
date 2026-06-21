import Link from "next/link";
import "../legal.css";
import { publicMetadata } from "../seo";
import { CookieSettingsButton } from "@/components/CookieSettingsButton";

export const metadata = publicMetadata({
  title: "Privacy Policy — Barri",
  description: "How Barri collects, uses, and protects your personal data.",
  path: "/privacy",
  noIndex: true,
});

// ANT-155: privacy policy scaffold. Structure follows GDPR Art. 13 disclosure
// requirements. Body text is a DRAFT and must be confirmed by legal counsel —
// in particular the processor list and international-transfer mechanisms depend
// on the outcome of the transfer audit (ANT-160). Sections marked TODO need
// vendor-specific facts before publication.
export default function PrivacyPage() {
  return (
    <div className="legal-root">
      <div className="legal-wrap">
        <Link href="/" className="legal-back">← Barri</Link>

        <div className="legal-draft">
          ⚠ DRAFT — pending legal review. This text is a structural placeholder
          and is not yet legally binding. Final wording, processor details, and
          transfer mechanisms must be confirmed by counsel before launch.
        </div>

        <h1 className="legal-h1">Privacy Policy</h1>
        <p className="legal-updated">Last updated: 13 June 2026</p>

        <h2 className="legal-h2">1. Who we are</h2>
        <p>
          Barri (&quot;we&quot;, &quot;us&quot;) operates the AI-Keeper tabletop
          RPG service at barrigame.es. <span className="legal-todo">TODO:
          legal entity name, registered address, and contact of the data
          controller.</span>
        </p>

        <h2 className="legal-h2">2. What data we collect</h2>
        <ul>
          <li><strong>Account data</strong> — your email address and account role.</li>
          <li><strong>Game content</strong> — the messages you send to the AI Keeper, your character/session state, and dice results.</li>
          <li><strong>Voice input</strong> — audio you record for speech-to-text, when you use the voice feature.</li>
          <li><strong>Technical data</strong> — IP address, browser/device information, and a strictly-necessary authentication cookie.</li>
        </ul>

        <h2 className="legal-h2">3. Why we process it (legal basis)</h2>
        <ul>
          <li>To provide the service (performance of a contract).</li>
          <li>To secure accounts and prevent abuse (legitimate interest).</li>
          <li>For optional features (consent, where required).</li>
        </ul>

        <h2 className="legal-h2">4. Service providers &amp; AI processors</h2>
        <p>
          To run the AI Keeper we share the necessary content with third-party
          processors. <span className="legal-todo">TODO: finalise the list,
          jurisdictions, and Data Processing Agreements per the transfer audit
          (ANT-160). Current providers include the LLM engine, image/voice/TTS
          providers and infrastructure.</span>
        </p>

        <h2 className="legal-h2">5. International transfers</h2>
        <p>
          Some processors are located outside the EU/EEA. Where this happens we
          rely on adequacy decisions, the EU-US Data Privacy Framework, or
          Standard Contractual Clauses. <span className="legal-todo">TODO:
          confirm the transfer mechanism for each provider, especially any
          provider in a country without an EU adequacy decision.</span>
        </p>

        <h2 className="legal-h2">6. Retention</h2>
        <p>
          We keep your data for as long as your account is active.
          <span className="legal-todo"> TODO: define concrete retention periods
          (ANT-162).</span>
        </p>

        <h2 className="legal-h2">7. Cookies</h2>
        <p>
          We use a single strictly-necessary cookie (<code>auth_token</code>) to
          keep you signed in. Optional product analytics is loaded only after
          consent and is used to understand product usage, not for advertising.
          Your analytics choice may be stored in local storage.
        </p>
        <p>
          You can change or withdraw your analytics choice at any time.
        </p>
        <CookieSettingsButton />

        <h2 className="legal-h2">8. Your rights</h2>
        <p>
          Under the GDPR you can access, correct, export, or delete your data,
          and object to or restrict processing. To exercise these rights, or to
          delete your account, contact{" "}
          <a href="mailto:post@barrigame.es">post@barrigame.es</a>.
          <span className="legal-todo"> TODO: link self-service deletion/export
          once shipped (ANT-159); add supervisory-authority (AEPD) complaint
          info.</span>
        </p>

        <h2 className="legal-h2">9. Contact</h2>
        <p>
          Questions about this policy:{" "}
          <a href="mailto:post@barrigame.es">post@barrigame.es</a>.
        </p>

        <p style={{ marginTop: 40 }}>
          <Link href="/terms">Terms of Service →</Link>
        </p>
      </div>
    </div>
  );
}
