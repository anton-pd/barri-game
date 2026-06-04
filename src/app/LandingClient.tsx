"use client";

import { useState } from "react";
import Link from "next/link";
import { CONTENT, type Lang } from "./content";

const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "uk", label: "УК" },
  { code: "es", label: "ES" },
];

export default function LandingClient() {
  const [lang, setLang] = useState<Lang>("en");
  const [navOpen, setNavOpen] = useState(false);
  const c = CONTENT[lang];

  return (
    <>
      {/* TOP BAR */}
      <header className="topbar">
        <div className="mark">
          <span className="seal">B</span>
          <span className="wordmark">Barri</span>
        </div>
        <nav>
          <a href="#exhibits">{c.nav.exhibits}</a>
          <a href="#procedure">{c.nav.procedure}</a>
          <a href="#cases">{c.nav.cases}</a>
          <a href="#testimony">{c.nav.testimony}</a>
        </nav>
        <div className="topbar-right">
          <div className="lang-switcher">
            {LANGS.map((l) => (
              <button
                key={l.code}
                className={`lang-btn${lang === l.code ? " active" : ""}`}
                onClick={() => setLang(l.code)}
              >
                {l.label}
              </button>
            ))}
          </div>
          <Link href="/auth/register" className="enter-btn">{c.nav.enter}</Link>
          <button
            className={`topbar-hamburger${navOpen ? " open" : ""}`}
            aria-label="Menu"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {navOpen && (
        <div className="topbar-mobile-nav" role="navigation">
          <a href="#exhibits" onClick={() => setNavOpen(false)}>{c.nav.exhibits}</a>
          <a href="#procedure" onClick={() => setNavOpen(false)}>{c.nav.procedure}</a>
          <a href="#cases" onClick={() => setNavOpen(false)}>{c.nav.cases}</a>
          <a href="#testimony" onClick={() => setNavOpen(false)}>{c.nav.testimony}</a>
        </div>
      )}

      {/* HERO */}
      <section className="hero">
        <div className="scratches" aria-hidden />
        <span className="hero-bg-mark m1" aria-hidden>Cthulhu</span>
        <span className="hero-bg-mark m2" aria-hidden>fhtagn</span>

        <div className="hero-inner">
          <div>
            <div className="hero-caseline reveal d1">
              <span>{c.hero.caseNo}</span>
              <span style={{ marginLeft: "auto" }}>{c.hero.filed}</span>
            </div>

            <h1 className="hero-title">
              <span className="line1 reveal d1">{c.hero.t1}</span>
              <span className="line2 reveal d2">{c.hero.t2}</span>
              <span className="line3 reveal d3">
                {c.hero.t3}<span className="caret" />
              </span>
            </h1>

            <p className="hero-lede reveal d4">
              {c.hero.lede}<span className="redact">{c.hero.redact}</span>{c.hero.ledeEnd}
            </p>

            <div className="hero-cta-row reveal d5">
              <Link href="/auth/register" className="btn-primary">
                {c.hero.cta} <span className="arrow">→</span>
              </Link>
              <a href="#exhibits" className="btn-ghost">{c.hero.ghost}</a>
            </div>
          </div>

          {/* Dossier card */}
          <aside className="dossier reveal d3" aria-hidden>
            <span className="paperclip" />
            <div className="dossier-header">
              <span>{c.dossier.county}</span>
              <span>{c.dossier.confidential}</span>
            </div>
            <h3>{c.dossier.subject}</h3>
            <div className="dossier-photo" />
            {c.dossier.rows.map((r) => (
              <div className="dossier-row" key={r.k}>
                <span className="k">{r.k}</span>
                <span className="v">{r.v}</span>
              </div>
            ))}
            <div className="dossier-stamp">
              {c.dossier.stamp}
              <small>{c.dossier.stampSub}</small>
            </div>
          </aside>
        </div>
      </section>

      {/* TICKER */}
      <div className="ticker" aria-hidden>
        <div className="ticker-track">
          {[...c.ticker, ...c.ticker].map((w, i) => (
            <span className="ticker-item" key={i}>{w}</span>
          ))}
        </div>
      </div>

      {/* EXHIBITS */}
      <section id="exhibits" className="section">
        <div className="section-header">
          <div>
            <div className="section-label">{c.exhibits.label}</div>
            <h2 className="section-title">
              {c.exhibits.heading[0]}<em>{c.exhibits.heading[1]}</em>
              <br />{c.exhibits.heading[2]}
            </h2>
          </div>
          <p className="section-desc">{c.exhibits.desc}</p>
        </div>

        <div className="exhibits">
          {c.exhibits.items.map((e) => (
            <article className="exhibit" key={e.num}>
              <span className="exhibit-num">{e.num}</span>
              <span className="exhibit-tag">{e.tag}</span>
              <h3>{e.title}</h3>
              <p>{e.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* PROCEDURE */}
      <section id="procedure" className="procedure">
        <div className="inner">
          <div className="procedure-heading">
            <div className="section-label">{c.procedure.label}</div>
            <h2>
              {c.procedure.heading[0]}<em>{c.procedure.heading[1]}</em>{c.procedure.heading[2]}
            </h2>
          </div>

          <ol className="steps">
            {c.procedure.steps.map((s) => (
              <li className="step" key={s.n}>
                <span className="step-num">{s.n}</span>
                <div className="step-body">
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
                <span className="step-tag">— {s.tag}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CASES */}
      <section id="cases" className="section cases">
        <div className="section-header">
          <div>
            <div className="section-label">{c.cases.label}</div>
            <h2 className="section-title">
              {c.cases.heading[0]}<em>{c.cases.heading[1]}</em>
            </h2>
          </div>
          <p className="section-desc">{c.cases.desc}</p>
        </div>

        <div className="case-grid">
          {c.cases.files.map((f) => (
            <article className={`case ${f.cls}`} key={f.id}>
              <div className="case-hdr">
                <span className="case-id">{f.id}</span>
                <span className={`case-badge${f.badgeSealed ? " sealed" : ""}`}>{f.badge}</span>
              </div>
              <h3>{f.title}</h3>
              <div className="case-sub">{f.sub}</div>
              <div className="case-image" />
              <div className="case-meta">
                {f.meta.map((m) => (
                  <div key={m.k}><span className="k">{m.k}</span>{m.v}</div>
                ))}
              </div>
              <p className="brief">{f.brief}</p>
              <div className="case-replayable">{f.replayable}</div>
              {f.cta ? (
                <Link href="/auth/register" className="case-open">{f.cta} →</Link>
              ) : (
                <span className="case-open" style={{ opacity: 0.45, borderColor: "transparent", cursor: "not-allowed" }}>
                  {f.replayable}
                </span>
              )}
              {f.stamp && <span className="case-stamp">{f.stamp}</span>}
            </article>
          ))}
        </div>
      </section>

      {/* TESTIMONY */}
      <section id="testimony" className="testimony">
        <div className="testimony-inner">
          <div className="testimony-heading">
            <div className="section-label">{c.testimony.label}</div>
            <h2>
              {c.testimony.heading[0]}<em>{c.testimony.heading[1]}</em>
            </h2>
          </div>

          <div className="notes">
            {c.testimony.notes.map((n) => (
              <figure className="note" key={n.name}>
                <q>{n.q}</q>
                <figcaption className="note-sig">
                  <strong>{n.name}</strong>
                  {n.role}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="final-cta">
        <div className="bgseal flicker" aria-hidden />
        <div className="seal-text" aria-hidden>℞</div>

        <div className="section-label">{c.cta.label}</div>
        <h2>
          {c.cta.h1}
          <em>{c.cta.h2}</em>
        </h2>
        <p>{c.cta.body}</p>
        <Link href="/auth/register" className="btn-primary" style={{ fontSize: 15 }}>
          {c.cta.btn} <span className="arrow">→</span>
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="foot">
        <div className="foot-brand">
          <span className="seal">B</span>
          <div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, letterSpacing: "0.22em", color: "var(--paper-0)" }}>
              BARRI
            </div>
            <div style={{ marginTop: 4, fontSize: 10 }}>The AI Keeper · barrigame.es</div>
          </div>
        </div>

        <div className="foot-cols">
          <div className="foot-col">
            <h4>Bureau</h4>
            <a href="#exhibits">{c.nav.exhibits}</a>
            <a href="#procedure">{c.nav.procedure}</a>
            <a href="#cases">{c.nav.cases}</a>
          </div>
          <div className="foot-col">
            <h4>Archive</h4>
            <a href="/sessions">{lang === "uk" ? "Сесії" : lang === "es" ? "Sesiones" : "Sessions"}</a>
            <a href="/admin">{lang === "uk" ? "Архів" : lang === "es" ? "Registros" : "Records"}</a>
          </div>
          <div className="foot-col">
            <h4>{lang === "uk" ? "Зв'язок" : lang === "es" ? "Contacto" : "Contact"}</h4>
            <a href="mailto:post@barrigame.es">post@barrigame.es</a>
            <a href="https://barrigame.es">barrigame.es</a>
          </div>
        </div>

        <div className="foot-credit">
          <span>{c.footer.credit1}</span>
          <span>{c.footer.credit2}</span>
        </div>
      </footer>
    </>
  );
}
