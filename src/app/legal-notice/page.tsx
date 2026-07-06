import Link from "next/link";
import "../legal.css";
import { LEGAL_INFO, LEGAL_LINKS } from "../legalInfo";
import { publicMetadata } from "../seo";

export const metadata = publicMetadata({
  title: "Legal Notice — Barri",
  description: "Basic legal and ownership information for Barri.",
  path: LEGAL_LINKS.legalNotice,
  noIndex: true,
});

export default function LegalNoticePage() {
  return (
    <div className="legal-root">
      <div className="legal-wrap">
        <Link href="/" className="legal-back">← Barri</Link>

        <h1 className="legal-h1">Legal Notice</h1>
        <p className="legal-updated">Last updated: {LEGAL_INFO.lastUpdated}</p>

        <p>
          This Legal Notice provides basic information about the website{" "}
          <a href={LEGAL_INFO.websiteUrl}>{LEGAL_INFO.websiteName}</a> and its
          operator.
        </p>

        <h2 className="legal-h2">1. Website operator</h2>
        <table className="legal-table">
          <tbody>
            <tr>
              <th>Service</th>
              <td>{LEGAL_INFO.serviceName}</td>
            </tr>
            <tr>
              <th>Website</th>
              <td><a href={LEGAL_INFO.websiteUrl}>{LEGAL_INFO.websiteUrl}</a></td>
            </tr>
            <tr>
              <th>Operator</th>
              <td>{LEGAL_INFO.operatorLabel}</td>
            </tr>
            <tr>
              <th>Contact</th>
              <td><a href={`mailto:${LEGAL_INFO.contactEmail}`}>{LEGAL_INFO.contactEmail}</a></td>
            </tr>
            <tr>
              <th>Status</th>
              <td>{LEGAL_INFO.commercialStatus}</td>
            </tr>
          </tbody>
        </table>
        <p className="legal-note">
          {LEGAL_INFO.statutoryDetailsNote}
        </p>

        <h2 className="legal-h2">2. Purpose of the website</h2>
        <p>
          Barri is an AI-assisted browser game for tabletop horror
          investigations. The public website provides information about the
          product, an instant demo, waiting-list access, and account-based game
          access for approved users.
        </p>

        <h2 className="legal-h2">3. Terms and policies</h2>
        <p>
          Use of Barri is governed by the <Link href={LEGAL_LINKS.terms}>Terms
          of Service</Link>, <Link href={LEGAL_LINKS.privacy}>Privacy Policy</Link>,
          and <Link href={LEGAL_LINKS.cookies}>Cookie Policy</Link>.
        </p>

        <h2 className="legal-h2">4. Intellectual property</h2>
        <p>
          Barri&apos;s software, interface, original text, design, brand elements,
          and original game materials are protected by intellectual-property
          laws. You may not copy, modify, distribute, or exploit them except as
          allowed by the Terms of Service or with written permission.
        </p>
        <p>
          Barri is an independent, original work of interactive fiction. All
          scenarios, characters, and game materials are original creations.
          Barri is not affiliated with, endorsed by, or sponsored by any
          tabletop role-playing game publisher.
        </p>

        <h2 className="legal-h2">5. User responsibility</h2>
        <p>
          Users must access the website lawfully, respect other users and the
          service, and avoid any use that could damage, overload, or interfere
          with Barri or third-party systems.
        </p>

        <h2 className="legal-h2">6. External links and providers</h2>
        <p>
          Barri may link to or rely on third-party services. We are not
          responsible for external websites or provider terms outside our
          control.
        </p>

        <h2 className="legal-h2">7. Applicable law</h2>
        <p>
          This website is operated under {LEGAL_INFO.governingLaw}, without
          prejudice to mandatory consumer rights that may apply to users in
          their country of residence.
        </p>

        <h2 className="legal-h2">8. Contact</h2>
        <p>
          For legal, privacy, or service questions, contact{" "}
          <a href={`mailto:${LEGAL_INFO.contactEmail}`}>{LEGAL_INFO.contactEmail}</a>.
        </p>

        <nav className="legal-links" aria-label="Legal pages">
          <Link href={LEGAL_LINKS.privacy}>Privacy Policy</Link>
          <Link href={LEGAL_LINKS.cookies}>Cookie Policy</Link>
          <Link href={LEGAL_LINKS.terms}>Terms of Service</Link>
        </nav>
      </div>
    </div>
  );
}
