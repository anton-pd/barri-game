import Link from "next/link";
import "../legal.css";
import { LEGAL_INFO, LEGAL_LINKS } from "../legalInfo";
import { publicMetadata } from "../seo";

export const metadata = publicMetadata({
  title: "Terms of Service — Barri",
  description: "The basic terms governing use of Barri.",
  path: LEGAL_LINKS.terms,
  noIndex: true,
});

export default function TermsPage() {
  return (
    <div className="legal-root">
      <div className="legal-wrap">
        <Link href="/" className="legal-back">← Barri</Link>

        <h1 className="legal-h1">Terms of Service</h1>
        <p className="legal-updated">Last updated: {LEGAL_INFO.lastUpdated}</p>

        <p>
          These Terms govern your use of Barri, an AI-assisted browser game for
          tabletop horror investigations operated by {LEGAL_INFO.operatorLabel}.
          By using Barri, joining the waiting list, creating an account, or
          playing the demo, you agree to these Terms.
        </p>

        <h2 className="legal-h2">1. The service</h2>
        <p>
          Barri lets users play fictional tabletop RPG sessions with an AI
          Keeper that narrates scenes, tracks state, handles dice rolls, and may
          generate text, audio, and images. {LEGAL_INFO.commercialStatus}
        </p>

        <h2 className="legal-h2">2. Eligibility</h2>
        <p>
          You must be at least {LEGAL_INFO.minimumAge} years old to use Barri.
          Barri contains fictional horror, occult, violence, fear, and mature
          themes. Do not use Barri if those themes are not suitable for you.
        </p>

        <h2 className="legal-h2">3. Accounts and access</h2>
        <ul>
          <li>You are responsible for keeping your account credentials secure.</li>
          <li>You must provide accurate information when joining the waiting list or creating an account.</li>
          <li>We may limit, suspend, or remove access if needed to protect the service or enforce these Terms.</li>
          <li>You may request account deletion by contacting <a href={`mailto:${LEGAL_INFO.contactEmail}`}>{LEGAL_INFO.contactEmail}</a>.</li>
        </ul>

        <h2 className="legal-h2">4. AI-generated entertainment</h2>
        <p>
          Barri is for entertainment. AI output is fictional, automatically
          generated, and may be inaccurate, surprising, repetitive, or
          inappropriate. It is not professional, legal, medical, psychological,
          financial, or safety advice.
        </p>
        <p>
          You are responsible for deciding what prompts and personal information
          you submit. Do not submit sensitive real-world information that is not
          needed for gameplay.
        </p>

        <h2 className="legal-h2">5. Your content</h2>
        <p>
          You keep any rights you have in prompts, messages, character names,
          and other content you submit. You give Barri a worldwide,
          non-exclusive, royalty-free licence to host, process, transmit,
          display, adapt, and use that content as needed to operate, improve,
          secure, and support the service.
        </p>
        <p>
          You must have the rights needed to submit any content you provide.
          Do not submit illegal content, private information about others, or
          content that infringes someone else&apos;s rights.
        </p>

        <h2 className="legal-h2">6. Acceptable use</h2>
        <ul>
          <li>Do not use Barri for unlawful, abusive, harassing, hateful, exploitative, or harmful purposes.</li>
          <li>Do not attempt to bypass access controls, usage limits, security measures, or waiting-list restrictions.</li>
          <li>Do not interfere with, overload, scrape, reverse-engineer, or attack the service.</li>
          <li>Do not use Barri to generate or distribute malware, spam, fraud, or instructions for real-world harm.</li>
          <li>Do not use Barri to process personal data about other people without a lawful basis.</li>
        </ul>

        <h2 className="legal-h2">7. Intellectual property</h2>
        <p>
          Barri, its software, interface, visual design, text, logos, and
          original game materials are owned by us or our licensors and are
          protected by intellectual-property laws. You may use them only as
          allowed by these Terms.
        </p>
        <p>
          Barri is an independent, original work of interactive fiction. All
          scenarios, characters, and game materials are original creations.
          Barri is not affiliated with, endorsed by, or sponsored by any
          tabletop role-playing game publisher.
        </p>

        <h2 className="legal-h2">8. Third-party services</h2>
        <p>
          Barri relies on third-party providers for hosting, email, AI models,
          speech, images, and optional analytics. Their services may have their
          own terms and availability limitations.
        </p>

        <h2 className="legal-h2">9. Availability and changes</h2>
        <p>
          Barri is provided on an &quot;as is&quot; and &quot;as available&quot; basis. We may
          change, limit, pause, or discontinue features, including demo access,
          scenarios, AI providers, or waiting-list access. We may update these
          Terms when the service changes. Material changes will be communicated
          where reasonably possible.
        </p>

        <h2 className="legal-h2">10. Liability</h2>
        <p>
          To the maximum extent permitted by law, Barri is not liable for
          indirect losses, lost profits, loss of data, unavailable service,
          third-party provider failures, or AI-generated content. Nothing in
          these Terms limits liability that cannot legally be limited, including
          liability for fraud, intentional misconduct, or rights you have as a
          consumer under mandatory law.
        </p>

        <h2 className="legal-h2">11. Governing law</h2>
        <p>
          These Terms are governed by {LEGAL_INFO.governingLaw}, without
          prejudice to any mandatory consumer protections that may apply in your
          country of residence. If a dispute arises, please contact us first at{" "}
          <a href={`mailto:${LEGAL_INFO.contactEmail}`}>{LEGAL_INFO.contactEmail}</a>
          so we can try to resolve it.
        </p>

        <h2 className="legal-h2">12. Contact</h2>
        <p>
          Questions about these Terms:{" "}
          <a href={`mailto:${LEGAL_INFO.contactEmail}`}>{LEGAL_INFO.contactEmail}</a>.
        </p>

        <nav className="legal-links" aria-label="Legal pages">
          <Link href={LEGAL_LINKS.privacy}>Privacy Policy</Link>
          <Link href={LEGAL_LINKS.cookies}>Cookie Policy</Link>
          <Link href={LEGAL_LINKS.legalNotice}>Legal Notice</Link>
        </nav>
      </div>
    </div>
  );
}
