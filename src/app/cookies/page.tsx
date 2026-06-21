import Link from "next/link";
import "../legal.css";
import { CookieSettingsButton } from "@/components/CookieSettingsButton";
import { LEGAL_INFO, LEGAL_LINKS } from "../legalInfo";
import { publicMetadata } from "../seo";

export const metadata = publicMetadata({
  title: "Cookie Policy — Barri",
  description: "How Barri uses strictly necessary cookies and optional analytics.",
  path: LEGAL_LINKS.cookies,
  noIndex: true,
});

export default function CookiePolicyPage() {
  return (
    <div className="legal-root">
      <div className="legal-wrap">
        <Link href="/" className="legal-back">← Barri</Link>

        <h1 className="legal-h1">Cookie Policy</h1>
        <p className="legal-updated">Last updated: {LEGAL_INFO.lastUpdated}</p>

        <p>
          This Cookie Policy explains how Barri uses cookies, local storage, and
          similar technologies on {LEGAL_INFO.websiteName}. It should be read
          together with our <Link href={LEGAL_LINKS.privacy}>Privacy Policy</Link>.
        </p>

        <h2 className="legal-h2">1. What cookies are</h2>
        <p>
          Cookies are small text files stored by your browser. Local storage is
          a similar browser storage mechanism. They can help keep you signed in,
          remember privacy choices, protect the service, or, where you consent,
          help us understand how the product is used.
        </p>

        <h2 className="legal-h2">2. Strictly necessary storage</h2>
        <p>
          These items are needed for the site to work and do not require
          analytics consent.
        </p>
        <table className="legal-table">
          <tbody>
            <tr>
              <th>Name</th>
              <th>Purpose</th>
              <th>Type</th>
            </tr>
            <tr>
              <td><code>auth_token</code></td>
              <td>Keeps signed-in users authenticated and protects account sessions.</td>
              <td>First-party cookie</td>
            </tr>
            <tr>
              <td><code>CookieConsent</code> or Cookiebot storage</td>
              <td>Stores your Cookiebot consent choices where Cookiebot is available.</td>
              <td>Consent cookie/storage</td>
            </tr>
            <tr>
              <td><code>barri_analytics_consent</code></td>
              <td>Stores your analytics choice if Cookiebot is blocked and Barri shows the fallback consent banner.</td>
              <td>First-party local storage</td>
            </tr>
          </tbody>
        </table>

        <h2 className="legal-h2">3. Optional analytics</h2>
        <p>
          Barri uses optional product analytics only after you consent. Analytics
          helps us understand whether the landing page, demo, and game flows are
          working. We do not use analytics for ads or cross-site tracking.
        </p>
        <table className="legal-table">
          <tbody>
            <tr>
              <th>Provider</th>
              <th>Purpose</th>
              <th>When loaded</th>
            </tr>
            <tr>
              <td>PostHog</td>
              <td>Product analytics such as page views, feature usage, demo progress, and technical product events.</td>
              <td>Only after analytics/statistics consent.</td>
            </tr>
          </tbody>
        </table>
        <p>
          PostHog requests are routed through a first-party Barri endpoint to
          improve reliability, but analytics still remains disabled until
          consent is granted.
        </p>

        <h2 className="legal-h2">4. Cookiebot and fallback consent</h2>
        <p>
          Where available, Barri uses Cookiebot CMP to collect and manage
          consent. If Cookiebot is blocked or does not become ready, Barri shows
          a first-party fallback banner for analytics consent. In both cases,
          analytics remains off unless you choose to allow it.
        </p>

        <h2 className="legal-h2">5. Change your choice</h2>
        <p>
          You can change or withdraw your analytics choice at any time.
        </p>
        <CookieSettingsButton />

        <h2 className="legal-h2">6. Browser controls</h2>
        <p>
          You can also delete cookies and local storage through your browser
          settings. If you block strictly necessary cookies, account login or
          session features may stop working.
        </p>

        <h2 className="legal-h2">7. Updates</h2>
        <p>
          We may update this Cookie Policy when we add, remove, or change
          cookies, analytics, or consent tools.
        </p>

        <nav className="legal-links" aria-label="Legal pages">
          <Link href={LEGAL_LINKS.privacy}>Privacy Policy</Link>
          <Link href={LEGAL_LINKS.terms}>Terms of Service</Link>
          <Link href={LEGAL_LINKS.legalNotice}>Legal Notice</Link>
        </nav>
      </div>
    </div>
  );
}
