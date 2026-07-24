"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CONTENT, type Lang } from "./content";
import type { ScenarioCatalogEntry } from "@/lib/scenarioCatalog";
import { getPublicAccess, type RegistrationMode } from "@/lib/registrationMode";

const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "uk", label: "УК" },
  { code: "es", label: "ES" },
];

export default function LandingClient({ registrationMode }: { registrationMode: RegistrationMode }) {
  const [lang, setLang] = useState<Lang>("en");
  const [scenarios, setScenarios] = useState<ScenarioCatalogEntry[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState(true);
  const c = CONTENT[lang];
  const accessCopy = c.access[registrationMode];
  const publicAccess = getPublicAccess(registrationMode, lang);
  const demoHref = `/demo?lang=${lang}`;
  const accessHref = publicAccess.registrationHref;

  useEffect(() => {
    const queryLang = new URLSearchParams(window.location.search).get("lang");
    if (queryLang === "en" || queryLang === "uk" || queryLang === "es") {
      setLang(queryLang);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadScenarios() {
      try {
        const res = await fetch("/api/scenarios");
        if (!res.ok) throw new Error("Could not load scenarios");
        const data = await res.json() as ScenarioCatalogEntry[];
        if (active) setScenarios(data);
      } catch {
        if (active) setScenarios([]);
      } finally {
        if (active) setScenariosLoading(false);
      }
    }

    loadScenarios();
    return () => {
      active = false;
    };
  }, []);

  const caseCopy = CASE_COPY[lang];

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
          <Link href={accessHref} className="enter-btn">{accessCopy.nav}</Link>
        </div>
      </header>

      {/* HERO */}
      <section className="hero">
        <div className="scratches" aria-hidden />
        <span className="hero-bg-mark m1" aria-hidden>Barri</span>
        <span className="hero-bg-mark m2" aria-hidden>Curator</span>

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

            <p className="hero-positioning reveal d4">{c.hero.kicker}</p>

            <p className="hero-lede reveal d4">
              {c.hero.lede}
            </p>

            <div className="hero-proof-row reveal d5" aria-label={c.hero.proofLabel}>
              {c.hero.proofs.map((proof) => (
                <span key={proof}>{proof}</span>
              ))}
            </div>

            <div className="hero-cta-row reveal d5">
              <Link href={demoHref} className="btn-primary">
                {c.hero.cta} <span className="arrow">→</span>
              </Link>
              <a href="#exhibits" className="btn-ghost">{c.hero.ghost}</a>
            </div>
          </div>

          <aside className="keeper-preview reveal d3" aria-label={c.preview.label}>
            <div className="keeper-preview-header">
              <span>{c.preview.label}</span>
              <strong>{c.preview.status}</strong>
            </div>
            <div className="keeper-preview-message">
              <span>{c.preview.messageMeta}</span>
              <p>{c.preview.message}</p>
            </div>
            <div className="keeper-preview-objective">
              <span>{c.preview.objectiveLabel}</span>
              <p>{c.preview.objective}</p>
            </div>
            <div className="keeper-preview-stats">
              {c.preview.stats.map((stat) => (
                <div key={stat.k}>
                  <span>{stat.k}</span>
                  <strong>{stat.v}</strong>
                </div>
              ))}
            </div>
            <div className="keeper-preview-input">
              <span>{c.preview.input}</span>
              <b aria-hidden>↵</b>
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
          <article className="case case-1 case-demo">
            <div className="case-hdr">
              <span className="case-id">{caseCopy.demo.id}</span>
              <span className="case-badge">{caseCopy.demo.badge}</span>
            </div>
            <h3>{caseCopy.demo.title}</h3>
            <div className="case-sub">{caseCopy.demo.sub}</div>
            <div className="case-image" />
            <div className="case-meta">
              {caseCopy.demo.meta.map((m) => (
                <div key={m.k}><span className="k">{m.k}</span>{m.v}</div>
              ))}
            </div>
            <p className="brief">{caseCopy.demo.brief}</p>
            <div className="case-replayable">{caseCopy.demo.replayable}</div>
            <Link href={demoHref} className="case-open">
              <span>{caseCopy.demo.cta}</span>
              <span aria-hidden="true">→</span>
            </Link>
            <span className="case-stamp">{caseCopy.demo.stamp}</span>
          </article>

          {scenariosLoading ? (
            <article className="case case-locked case-loading">
              <div className="case-hdr">
                <span className="case-id">{caseCopy.loading.id}</span>
                <span className="case-badge sealed">{caseCopy.loading.badge}</span>
              </div>
              <h3>{caseCopy.loading.title}</h3>
              <div className="case-sub">{caseCopy.loading.sub}</div>
              <div className="case-image" />
              <p className="brief">{caseCopy.loading.brief}</p>
            </article>
          ) : (
            scenarios.map((scenario, index) => (
              <article className={`case case-locked case-${(index % 2) + 2}`} key={scenario.id}>
                <div className="case-hdr">
                  <span className="case-id">{formatScenarioId(index, scenario, caseCopy)}</span>
                  <span className="case-badge sealed">{caseCopy.locked.badge}</span>
                </div>
                <h3>{getScenarioTitle(scenario, lang)}</h3>
                <div className="case-sub">{scenario.era}</div>
                <div className={`case-image${scenario.cover ? " case-image--cover" : ""}`}>
                  {scenario.cover && (
                    <Image
                      src={scenario.cover}
                      alt=""
                      fill
                      sizes="(min-width: 1180px) 30vw, (min-width: 760px) 45vw, 92vw"
                    />
                  )}
                </div>
                <div className="case-meta">
                  <div><span className="k">{caseCopy.locked.metaSessions}</span>{formatSessions(scenario, caseCopy)}</div>
                  <div><span className="k">{caseCopy.locked.metaPlayers}</span>{formatPlayers(scenario, caseCopy)}</div>
                  <div><span className="k">{caseCopy.locked.metaTone}</span>{formatDifficulty(scenario.difficulty, caseCopy)}</div>
                  <div><span className="k">{caseCopy.locked.metaAccess}</span>{caseCopy.locked.accessValue}</div>
                </div>
                <p className="brief">{scenario.description}</p>
                <div className="case-replayable">{caseCopy.locked.replayable}</div>
                <span className="case-open case-open--disabled">
                  <span>{caseCopy.locked.primary}</span>
                  <span aria-hidden="true">×</span>
                </span>
                <Link href={accessHref} className="case-secondary">
                  {accessCopy.case}
                </Link>
                <span className="case-stamp">{caseCopy.locked.stamp}</span>
              </article>
            ))
          )}
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
        <p>
          {accessCopy.body}
          <span className="final-cta-availability">{c.access.availability}</span>
        </p>
        <Link href={accessHref} className="btn-primary" style={{ fontSize: 15 }}>
          {accessCopy.cta} <span className="arrow">→</span>
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="foot">
        <div className="foot-brand">
          <span className="seal">B</span>
          <div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, letterSpacing: "0.05em", color: "var(--paper-0)" }}>
              BARRI
            </div>
            <div style={{ marginTop: 4, fontSize: 10 }}>The AI Case Curator · barrigame.es</div>
          </div>
        </div>

        <div className="foot-cols">
          <div className="foot-col">
            <h3>Bureau</h3>
            <a href="#exhibits">{c.nav.exhibits}</a>
            <a href="#procedure">{c.nav.procedure}</a>
            <a href="#cases">{c.nav.cases}</a>
          </div>
          <div className="foot-col">
            <h3>Archive</h3>
            <a href="/sessions">{lang === "uk" ? "Сесії" : lang === "es" ? "Sesiones" : "Sessions"}</a>
            <a href="/admin">{lang === "uk" ? "Архів" : lang === "es" ? "Registros" : "Records"}</a>
          </div>
          <div className="foot-col">
            <h3>{lang === "uk" ? "Зв'язок" : lang === "es" ? "Contacto" : "Contact"}</h3>
            <a href="mailto:post@barrigame.es">post@barrigame.es</a>
            <a href="https://barrigame.es">barrigame.es</a>
          </div>
          <div className="foot-col">
            <h3>{lang === "uk" ? "Правове" : lang === "es" ? "Legal" : "Legal"}</h3>
            <a href="/privacy">{lang === "uk" ? "Приватність" : lang === "es" ? "Privacidad" : "Privacy"}</a>
            <a href="/cookies">{lang === "uk" ? "Куки" : lang === "es" ? "Cookies" : "Cookies"}</a>
            <a href="/terms">{lang === "uk" ? "Умови" : lang === "es" ? "Términos" : "Terms"}</a>
            <a href="/legal-notice">{lang === "uk" ? "Правова інформація" : lang === "es" ? "Aviso legal" : "Legal Notice"}</a>
          </div>
        </div>

        <div className="foot-credit">
          <span>{c.footer.credit1}</span>
          <span>{c.footer.credit2}</span>
          <span>{c.footer.disclaimer}</span>
        </div>
      </footer>
    </>
  );
}

const CASE_COPY = {
  en: {
    demo: {
      id: "File № 00 · Demo",
      badge: "Demo",
      title: "The Cursed Archive",
      sub: "A sealed Bureau door. A single-player text preview.",
      meta: [
        { k: "Access", v: "Open" },
        { k: "Players", v: "1" },
        { k: "Tone", v: "Occult preview" },
        { k: "Limit", v: "10 AI turns / 15 min" },
      ],
      brief:
        "Type what your investigator does before Archive 7. The Case Curator responds through the real Barri prompt pipeline, tracks discoveries, and closes the file when the door opens.",
      replayable: "Public preview · no account required",
      cta: "Try Case Curator",
      stamp: "Open Demo",
    },
    locked: {
      idPrefix: "File",
      badge: "Access Denied",
      metaSessions: "Sessions",
      metaPlayers: "Players",
      metaTone: "Tone",
      metaAccess: "Access",
      accessValue: "Registered only",
      replayable: "Sealed file · registered investigators only",
      primary: "Access denied",
      stamp: "Sealed",
      rulesetLabel: "D100 HORROR",
      oneShot: "1",
      campaign: "Campaign",
      unknown: "—",
      difficulty: {
        beginner: "Beginner",
        intermediate: "Intermediate",
        advanced: "Advanced",
      },
    },
    loading: {
      id: "Cabinet · Syncing",
      badge: "Cataloguing",
      title: "Reading the Archive",
      sub: "Real case files are being pulled from the cabinet.",
      brief: "The clerk is still stamping the list. The sealed files will appear when the index returns.",
    },
  },
  uk: {
    demo: {
      id: "Справа № 00 · Демо",
      badge: "Демо",
      title: "Проклятий Архів",
      sub: "Запечатані двері Бюро. Одиночне текстове превʼю.",
      meta: [
        { k: "Доступ", v: "Відкрито" },
        { k: "Гравці", v: "1" },
        { k: "Тон", v: "Окультне прев'ю" },
        { k: "Ліміт", v: "10 ходів AI / 15 хв" },
      ],
      brief:
        "Напишіть, що ваш слідчий робить перед Архівом 7. Куратор справи відповідає через реальний prompt pipeline Barri, веде знахідки й закриває файл, коли двері відчиняються.",
      replayable: "Публічне прев'ю · акаунт не потрібен",
      cta: "Спробувати Куратора",
      stamp: "Демо",
    },
    locked: {
      idPrefix: "Справа",
      badge: "Доступ закрито",
      metaSessions: "Сесії",
      metaPlayers: "Гравці",
      metaTone: "Тон",
      metaAccess: "Доступ",
      accessValue: "Лише зареєстровані",
      replayable: "Запечатаний файл · тільки для зареєстрованих слідчих",
      primary: "Доступ закрито",
      stamp: "Закрито",
      rulesetLabel: "D100 ЖАХ",
      oneShot: "1",
      campaign: "Кампанія",
      unknown: "—",
      difficulty: {
        beginner: "Початковий",
        intermediate: "Середній",
        advanced: "Складний",
      },
    },
    loading: {
      id: "Архів · Синхронізація",
      badge: "Каталог",
      title: "Читаємо архів",
      sub: "Реальні справи підтягуються з шухляди.",
      brief: "Клерк ще ставить печатки. Запечатані файли з'являться, щойно індекс повернеться.",
    },
  },
  es: {
    demo: {
      id: "Expediente № 00 · Demo",
      badge: "Demo",
      title: "El Archivo Maldito",
      sub: "Una puerta sellada del Buró. Vista de texto para un jugador.",
      meta: [
        { k: "Acceso", v: "Abierto" },
        { k: "Jugadores", v: "1" },
        { k: "Tono", v: "Vista oculta" },
        { k: "Límite", v: "10 turnos IA / 15 min" },
      ],
      brief:
        "Escribe qué hace tu investigador frente al Archivo 7. El Curador responde con el prompt real de Barri, registra tus hallazgos y cierra el expediente cuando la puerta se abre.",
      replayable: "Vista pública · sin cuenta",
      cta: "Probar Curador",
      stamp: "Demo",
    },
    locked: {
      idPrefix: "Expediente",
      badge: "Acceso denegado",
      metaSessions: "Sesiones",
      metaPlayers: "Jugadores",
      metaTone: "Tono",
      metaAccess: "Acceso",
      accessValue: "Solo registrados",
      replayable: "Expediente sellado · solo investigadores registrados",
      primary: "Acceso denegado",
      stamp: "Sellado",
      rulesetLabel: "D100 TERROR",
      oneShot: "1",
      campaign: "Campaña",
      unknown: "—",
      difficulty: {
        beginner: "Inicial",
        intermediate: "Intermedio",
        advanced: "Avanzado",
      },
    },
    loading: {
      id: "Archivo · Sincronizando",
      badge: "Catálogo",
      title: "Leyendo el archivo",
      sub: "Los expedientes reales se están cargando desde el gabinete.",
      brief: "El secretario aún está sellando la lista. Los expedientes aparecerán cuando vuelva el índice.",
    },
  },
} as const;

function getScenarioTitle(scenario: ScenarioCatalogEntry, lang: Lang) {
  if (lang === "uk") return scenario.titleUk || scenario.title;
  return scenario.title;
}

function formatScenarioId(index: number, scenario: ScenarioCatalogEntry, copy: typeof CASE_COPY[Lang]) {
  const number = String(index + 1).padStart(2, "0");
  const suffix = scenario.rulesetId === "coc_7e"
    ? copy.locked.rulesetLabel
    : scenario.rulesetId?.replace("_", " ").toUpperCase() ?? "CASE";
  return `${copy.locked.idPrefix} № ${number} · ${suffix}`;
}

function formatSessions(scenario: ScenarioCatalogEntry, copy: typeof CASE_COPY[Lang]) {
  if (scenario.sessionConfig?.isCampaign) return copy.locked.campaign;
  return String(scenario.sessionConfig?.estimatedSessions ?? copy.locked.oneShot);
}

function formatPlayers(scenario: ScenarioCatalogEntry, copy: typeof CASE_COPY[Lang]) {
  const min = scenario.sessionConfig?.minPlayers;
  const max = scenario.sessionConfig?.maxPlayers;
  if (!min || !max) return copy.locked.unknown;
  return min === max ? String(min) : `${min} – ${max}`;
}

function formatDifficulty(
  difficulty: ScenarioCatalogEntry["difficulty"],
  copy: typeof CASE_COPY[Lang]
) {
  return copy.locked.difficulty[difficulty];
}
