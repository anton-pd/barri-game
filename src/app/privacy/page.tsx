import Link from "next/link";
import "../legal.css";
import { CookieSettingsButton } from "@/components/CookieSettingsButton";
import { LEGAL_INFO, LEGAL_LINKS } from "../legalInfo";
import { publicMetadata } from "../seo";

export const metadata = publicMetadata({
  title: "Privacy Policy — Barri",
  description: "How Barri collects, uses, stores, and protects personal data.",
  path: LEGAL_LINKS.privacy,
  noIndex: true,
});

export default function PrivacyPage() {
  return (
    <div className="legal-root">
      <div className="legal-wrap">
        <Link href="/" className="legal-back">← Barri</Link>

        <h1 className="legal-h1">Privacy Policy</h1>
        <p className="legal-updated">Last updated: {LEGAL_INFO.lastUpdated}</p>

        <p>
          This Privacy Policy explains how {LEGAL_INFO.operatorLabel} (&quot;Barri&quot;,
          &quot;we&quot;, &quot;us&quot;) processes personal data when you visit{" "}
          <a href={LEGAL_INFO.websiteUrl}>{LEGAL_INFO.websiteName}</a>, join the
          waiting list, create an account, try the demo, or play a Barri game
          session.
        </p>

        <h2 className="legal-h2">1. Controller and contact</h2>
        <p>
          The data controller is {LEGAL_INFO.operatorName}. You can contact us
          about privacy or data-protection questions at{" "}
          <a href={`mailto:${LEGAL_INFO.contactEmail}`}>{LEGAL_INFO.contactEmail}</a>.
        </p>
        <p className="legal-note">
          {LEGAL_INFO.statutoryDetailsNote}
        </p>

        <h2 className="legal-h2">2. Personal data we process</h2>
        <ul>
          <li>
            <strong>Account and waiting-list data:</strong> email address,
            verification status, role, access status, and related account
            metadata.
          </li>
          <li>
            <strong>Game content:</strong> messages you send, AI Keeper
            responses, character names, roles, dice rolls, inventory, session
            state, campaign summaries, feedback, and generated game materials.
          </li>
          <li>
            <strong>Voice and media features:</strong> audio you choose to
            submit for speech-to-text, generated voice/audio, and generated
            images. Barri stores the resulting game content where needed for
            session continuity.
          </li>
          <li>
            <strong>Technical and security data:</strong> IP address, browser
            and device data, request logs, authentication cookies, and abuse or
            error diagnostics.
          </li>
          <li>
            <strong>Optional analytics:</strong> product events such as page
            views, demo progress, and feature usage, only after analytics
            consent.
          </li>
        </ul>

        <h2 className="legal-h2">3. Why we process data</h2>
        <table className="legal-table">
          <tbody>
            <tr>
              <th>Purpose</th>
              <th>Legal basis</th>
            </tr>
            <tr>
              <td>Provide accounts, waiting-list access, demo play, sessions, and AI Keeper features.</td>
              <td>Contract or steps requested before a contract.</td>
            </tr>
            <tr>
              <td>Save sessions, campaign state, and gameplay history.</td>
              <td>Contract and legitimate interest in providing a continuous game service.</td>
            </tr>
            <tr>
              <td>Protect accounts, prevent abuse, debug errors, and operate infrastructure.</td>
              <td>Legitimate interest and legal obligations.</td>
            </tr>
            <tr>
              <td>Send account, verification, access, or service emails.</td>
              <td>Contract, legitimate interest, or consent where required.</td>
            </tr>
            <tr>
              <td>Understand product usage through optional analytics.</td>
              <td>Consent.</td>
            </tr>
          </tbody>
        </table>

        <h2 className="legal-h2">4. AI processing and service providers</h2>
        <p>
          To run the service we use hosting, database, email, analytics, AI,
          speech-to-text, text-to-speech, and image-generation providers. The
          active provider depends on the feature used and Barri&apos;s current
          configuration. Current provider categories include:
        </p>
        <ul>
          <li>Hosting and infrastructure providers for the Barri application and database.</li>
          <li>Email delivery providers for verification, access, and service messages.</li>
          <li>AI model providers and routing services for Keeper narration, summaries, speech, and images.</li>
          <li>Product analytics providers for optional consent-based analytics.</li>
        </ul>
        <p>
          We only send providers the information needed for the relevant
          feature. Game prompts can include your messages, session state, and
          character details so the AI Keeper can respond consistently.
        </p>

        <h2 className="legal-h2">5. International transfers</h2>
        <p>
          Some providers may process data outside the European Economic Area.
          Where required, we rely on appropriate safeguards such as adequacy
          decisions, the EU-US Data Privacy Framework, Standard Contractual
          Clauses, provider data-processing terms, and technical safeguards.
        </p>

        <h2 className="legal-h2">6. Cookies and analytics</h2>
        <p>
          Barri uses strictly necessary cookies for authentication and security.
          Optional analytics is loaded only after consent. You can read more in
          the <Link href={LEGAL_LINKS.cookies}>Cookie Policy</Link> and change
          your analytics choice at any time.
        </p>
        <CookieSettingsButton />

        <h2 className="legal-h2">7. Retention</h2>
        <ul>
          <li>Waiting-list and account data is kept until you request deletion or the data is no longer needed.</li>
          <li>Game sessions and campaign data are kept until you delete them, request account deletion, or we remove inactive data during operational cleanup.</li>
          <li>Voice input is used to provide speech-to-text. Barri does not intentionally keep raw voice recordings longer than needed to process the feature, unless a provider temporarily processes them under its own processing terms.</li>
          <li>Security and server logs are kept only as long as reasonably needed for security, debugging, and legal compliance.</li>
          <li>Analytics data is kept only for as long as needed to understand product usage and can be stopped by withdrawing consent.</li>
        </ul>

        <h2 className="legal-h2">8. Your rights</h2>
        <p>
          Under the GDPR, you may have the right to access, correct, delete,
          restrict, object to processing, and receive a copy of your personal
          data. Where processing is based on consent, you may withdraw that
          consent at any time.
        </p>
        <p>
          To exercise your rights, email{" "}
          <a href={`mailto:${LEGAL_INFO.contactEmail}`}>{LEGAL_INFO.contactEmail}</a>.
          You also have the right to lodge a complaint with the Spanish data
          protection authority, the{" "}
          <a href="https://www.aepd.es/" rel="noreferrer">AEPD</a>.
        </p>

        <h2 className="legal-h2">9. Security</h2>
        <p>
          We use technical and organisational measures designed to protect the
          service and personal data. No internet service can be guaranteed to be
          perfectly secure, so please use a strong password and do not submit
          sensitive real-world information unless it is necessary.
        </p>

        <h2 className="legal-h2">10. Changes</h2>
        <p>
          We may update this Privacy Policy when the service, providers, or law
          changes. The latest version will always be available on this page.
        </p>

        <nav className="legal-links" aria-label="Legal pages">
          <Link href={LEGAL_LINKS.cookies}>Cookie Policy</Link>
          <Link href={LEGAL_LINKS.terms}>Terms of Service</Link>
          <Link href={LEGAL_LINKS.legalNotice}>Legal Notice</Link>
        </nav>
      </div>
    </div>
  );
}
