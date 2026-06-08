# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

---

## [0.4.18] — 2026-06-04

### Added
- **Bespoke painterly cover art per scenario (ANT-99 follow-up).** Generated a dedicated pulp-poster cover for every scenario instead of reusing a location/clue image: 1920s occult-detective movie-poster key art (moody chiaroscuro, fog, amber light, sepia/teal), one hand-authored subject per scenario. `scripts/generate-covers.mjs` (committed, documents the prompts) generates `cover.jpg` via Gemini `gemini-2.5-flash-image`; covers are post-processed to 900×600 JPEG (~45–80 KB) and kept separate from in-game `staticImages`. `GET /api/scenarios` now prefers `cover.jpg` when present, falling back to the first static image. Added a `cover` entry to `STYLE_MAP`.

## [0.4.17] — 2026-06-03

### Changed
- **Sessions list: scenario cover art + noir restyle for available/closed cases (ANT-99).**
  - **Cover art with zero generation cost** — `GET /api/scenarios` now returns a `cover` URL per scenario, computed server-side from the first `staticImage` whose file already exists on disk (cached assets only; never triggers image generation).
  - **No more ∞ placeholder** — session cards fall back to the scenario cover when there's no session-generated scene yet, so freshly-created sessions show real imagery.
  - **Available case files** get a cover hero thumbnail (with a sealed-paper fallback + "Справа" classified tab) so they match the landing case-file grammar instead of being flat panels.
  - **Closed cases** render muted (desaturated thumbnail + lower opacity, brightening on hover) with the existing "Закрито" stamp, so they read clearly differently from active ones.

## [0.4.16] — 2026-06-03

### Changed
- **Inspector rail dossier rebuild + collapse (ANT-102).** The case-files panel (`CaseFilesPanel`) is no longer a generic dark panel with four mutually-exclusive tabs:
  - **Persistent summary at the top** — case status stamp (active/paused/done), current location, objective, and key counts (matérials / NPCs / locations) are always visible without switching tabs.
  - **Collapsible sections** (native `<details>`) replace the tab strip: Опис справи + Слідчі open by default; Персонажі and Матеріали collapse. Static scenario images now load lazily only when the Матеріали section is opened.
  - **Dossier visuals**: differentiated rail surface, NPC **relationship stamps** (friendly/hostile/neutral/unknown) and **evidence cards** with captions for generated images.
  - **Desktop collapse**: the rail can collapse to a 48px icon-only strip (expand chevron + live counts), state persisted in `localStorage`; the 📋 header button now collapses/expands on desktop and opens the drawer on mobile (previously the desktop ✕ did nothing). Mobile keeps the bottom-sheet drawer with the same hierarchy.

## [0.4.15] — 2026-06-03

### Added
- **Atmosphere & motion pass with reduced-motion fallbacks (ANT-103).** Purposeful, subtle motion in the game chat:
  - New-message reveal — the newest bubble fades + rises 6px (≤180ms), keyed by message id so streaming chunks don't re-trigger it.
  - Settings panel reveal when toggled open.
  - Evidence-image loading: replaced the generic Tailwind pulse with an on-brand aged-paper shimmer ("Проявляється світлина…") while `/api/image` resolves.
  - `prefers-reduced-motion: reduce` is honoured everywhere: message reveal, settings reveal, loading dots, replay pulse, and image shimmer all stop (final state stays visible); the sidebar drawer slide becomes instant; the dice roller skips its slot-machine flicker and shows the result immediately. Grain stays static (already disabled in chat).

## [0.4.14] — 2026-06-03

### Fixed
- **Location stopped updating after a situational (dynamic) location (ANT-68).** The periodic world-state summary (Haiku/Gemini, every 20 messages) merged the summary LLM's JSON over the live state with `{ ...current, ...parsed }`, letting `parsed.currentLocation` / `parsed.visitedLocations` overwrite the authoritative navigation state that is maintained deterministically by `[LOCATION:]` / `[NEW_LOCATION:]` tag parsing. Because the summary LLM doesn't reliably know the ids of dynamic locations (e.g. `my_apartments`) and the summary runs fire-and-forget (its `updateSession` can land after the main one), the displayed location got "stuck" until a clear `[LOCATION:<standard>]` reset it. Now the summary contributes only narrative fields (act, summary, clues, NPC relations, threads, notes); navigation, engine, and cache fields are always kept from the authoritative current state. Extracted the merge into pure `src/lib/worldStateMerge.ts` with unit coverage.

## [0.4.13] — 2026-06-03

### Added
- **Release gate: waiting-list access control + per-user daily cost cap (ANT-108).**
  - **Waiting list:** registration stays open, but new accounts land in a `pending` state and cannot start sessions or take AI turns until an admin approves them. Lets us open access gradually for the public launch. Existing accounts were backfilled to `approved` (no lockout); admins are always `approved` and bypass every gate.
  - **Per-user daily cost cap:** once a user's API spend for the day (UTC) reaches the configured USD cap, their AI turns are blocked with a friendly message until midnight. Admins are exempt. Cap value + on/off toggle are editable in the admin Settings tab (`daily_user_cost_limit_usd`, `daily_limit_enabled`; default $0.50/day).
  - **Admin Users tab:** new Access column (waiting list / approved / blocked) with Approve/Block controls, today's spend per user, and a count of accounts awaiting access.
  - **Registration success screen** now tells new recruits they're on the waiting list and access opens in small groups.
  - Pending/blocked users see a dedicated waiting-list screen on `/sessions` instead of the case files.

## [0.4.12] — 2026-06-03

### Fixed
- **Campaign completion UX (review feedback on ANT-77/78/81):**
  - Swapped end-button colors: "Завершити вечір" is now the softer secondary (black), while "Завершити кампанію достроково" (ending the whole game) is the terminal primary (red). One-shot "Закрити сесію" stays red.
  - **Both** finishing an evening and finishing the whole campaign now return the player to the case list (`/sessions`) after the feedback modal, instead of dropping straight into the next evening / staying on the read-only chat. One-shot completion still stays on the read-only chat.
  - Session-list action relabelled from "Увійти" to "Продовжити" (and "Переглянути" for completed sessions).
  - **Played evenings no longer look like closed cases**: a finished evening of an ongoing campaign now sits under "Відкриті справи" alongside its active evening with a "Вечір зіграно" stamp (read-only via "Переглянути"), instead of showing as "Закрито" in the completed section. Only fully finished games remain under "Завершено".

## [0.4.11] — 2026-06-03

### Fixed
- **Campaign continuity re-enabled (ANT-77–81).** The multi-evening campaign subsystem was fully built but disabled at the entry point, so none of it was reachable. Re-enabled and fixed:
  - **ANT-79/80/81**: `POST /api/sessions` now creates a campaign record and links session 1 (`campaign_id`, `session_number: 1`) automatically when the scenario declares `sessionConfig.isCampaign` (e.g. *The Last Telegram*). This unblocks world-state inheritance between evenings (`buildNextSessionWorldState`), prior-evening summaries in the next intro (`getCampaignContext` → prompt), and the finish-evening → next-session flow.
  - **ANT-77**: a Keeper emitting `[FINISH_EVENING]` / `[COMPLETE_SESSION]` no longer silently closes the session — it opens the confirmation modal so the player explicitly confirms (and can leave feedback) first. Removed the redundant `window.confirm` on top of the modal.
  - **ANT-78**: a finished campaign evening now shows campaign-aware read-only copy plus a clear way forward — a "Продовжити — Вечір N" link to the next evening (located via `/api/sessions`), or a fallback link to the case list.

### Changed
- Extracted `buildNextSessionWorldState` → `src/lib/campaignState.ts` and completion-tag detection → `src/lib/completionTags.ts` (`detectCompletionAction`), re-imported in the routes. Pure, single-sourced, unit-tested. No behavior change.
- **`closeSession` hardened**: the Haiku summarization call is now wrapped so a finish-evening never hard-fails (HTTP 500) on an LLM auth/network/JSON error, or when the model returns JSON without a usable `summary` (would violate the `session_summaries.summary` NOT NULL constraint) — the evening still closes and the next one is created with a validated, non-empty fallback summary. Also instantiates the Anthropic client with an explicit `apiKey` to match the rest of the codebase.
- **Scenario data**: `the-last-telegram` `sessionConfig.isCampaign` set to `true` in shared scenario data so the campaign flow is actually reachable.

### Added
- Campaign unit tests on the ANT-107 harness: `tests/campaignState.test.ts` (carry/reset invariants), `tests/completionTags.test.ts` (tag precedence), `tests/campaignContext.test.ts` (summary formatting, Anthropic SDK + queries mocked). Suite now at 44 tests.

## [0.4.10] — 2026-06-03

### Added
- **Test harness (ANT-107)**: Vitest unit-test infrastructure — `vitest.config.ts` (node env, `globals`, native tsconfig path alias), `npm test` / `npm test:watch` scripts. First suites (34 tests) cover deterministic core logic: `parseSegments`/`stripNpcTags`/`hasNpcSpeech` (`tests/segments.test.ts`), inventory tag mutations (`tests/inventoryTags.test.ts`), random-event probability engine (`tests/randomEvents.test.ts`), and `buildSystemPromptBlocks` shape + campaign-summary gating (`tests/prompts.test.ts`). LLM is never called — pure logic only. Shared fixtures in `tests/fixtures.ts`.

### Changed
- **Extracted `parseInventoryTags`** from `src/app/api/ai/route.ts` into `src/lib/inventoryTags.ts` (pure, unit-testable) and re-imported it in the route. No behavior change.

## [0.4.9] — 2026-05-08

### Changed
- **Reading column + transcript rhythm (ANT-100)**: chat messages container is now centered with `max-width: 820px`. Bubble max-widths re-tuned (keeper/NPC 92%, user 75%) and consecutive same-speaker turns drop the repeated rail label and tighten vertical spacing.
- **Composer rail (ANT-101)**: collapsed five stacked strips below the transcript (player tabs, queue, inventory, dice hint, input) into a single `.composer-rail` container. Shared background + border, single safe-area inset, `ХІД` label anchors the active-player tabs, queued actions sit on the right with a dashed divider; on ≤640px the queue wraps into its own row.
- **Mobile UX polish (ANT-104)**:
  - Sessions topbar: on ≤720px collapses version + admin link + email + sign-out into a circular avatar menu (initial of the email) with scrim and ARIA roles.
  - Chat case-files panel: replaced Tailwind right-side overlay with a semantic `.chat-sidebar`. Desktop keeps a 320px inspector rail; mobile (≤767px) becomes a bottom-sheet (88vh) with drag handle, scrim, and tap-to-close.
  - Inventory strip: scroll-snap + mask-image fade edges so off-screen chips signal they are scrollable.

---

## [0.4.8] — 2026-05-08

### Fixed
- **StatsBar regression (ANT-98)**: HP / SAN / Luck were not rendered anywhere in `GameChat` because the `StatsBar` component was no longer imported. Wired it back into the chat shell as a persistent strip below the header.

### Changed
- StatsBar restyled from Tailwind `stone/amber` utility classes to semantic noir classes (`.stats-bar`, `.stats-card`, `.stat-row`, `.inv-item`) using landing tokens — HP blood gradient, SAN bruise, Luck amber. Active-player card highlighted with amber inset; clicking a card sets the active player and toggles skills + inventory.
- **Stats are system-controlled only.** Removed `+/−` controls and the manual `PATCH /api/sessions/:id` players writer. Added explicit rule in the Keeper system prompt (UA + EN) forbidding stat changes on direct player request — only fiction-grounded events flowing through `[DELTA:]` may mutate stats.

---

## [0.4.7] — 2026-04-24

### Added
- **Game Chat noir redesign**: full visual overhaul of the game session UI (`/session/[id]`) to match the noir-dossier design language.
  - New `session/[id]/layout.tsx`: wraps game page in `landing-root` with all 6 noir fonts.
  - New `session/[id]/chat.css`: ~450 lines of semantic noir chat classes.
  - Keeper narration bubbles: aged paper gradient, IM Fell English italic, quotation mark glyph, notched top-left corner.
  - NPC speech bubbles: darker paper with blood-red left border accent.
  - Player action bubbles: ink-dark background, typewriter font.
  - Header: location, status badge (active/paused/complete), back button — all in noir palette.
  - Settings panel: keeper-style toggle, ambient volume, completion stats, manual-end controls — all redesigned.
  - Input zone: telegraphic bottom-border textarea, ink-background send button with blood shadow.
  - Inventory strip, player selector, pending action pills, dice hint — all redesigned.
  - Completion modal: dossier-card overlay with noir feedback form.
  - Grain animation disabled in chat context (static 13% opacity) to prevent eye strain during long sessions.

---

## [0.4.6] — 2026-04-22

### Added
- **Sessions page noir redesign (Tier 1 + Tier 2)**: full visual overhaul of `/sessions` to match noir-dossier design language.
  - Session cards: scene thumbnail (from `world_state.sessionImages`), torn top edge, status stamp (АКТИВНА / НА ПАУЗІ / ЗАКРИТО), current location, player chips with HP/SAN, "Previously..." summary snippet.
  - Scenario cards always visible on page — clicking opens the new-session modal pre-configured for that scenario (no multi-step modal picker).
  - Bureau Statistics strip: active / paused / completed / total messages counts.
  - Empty state for new users with blackletter glyph and copy.
  - `sessions/layout.tsx` loads all noir fonts and CSS tokens via `landing-root`.
- **`getSessionsByUserId` query extended**: now returns `latest_summary` (from `session_summaries`) and `message_count` (from `messages`) per session.

---

## [0.4.5] — 2026-04-21

### Fixed
- **Cyrillic font fallbacks**: Special Elite and IM Fell English lack Cyrillic glyphs; Ukrainian text now falls back to PT Mono (typewriter) and PT Serif (oldprint) instead of system sans-serif. Playfair Display updated to include `cyrillic` subset.
- **"Forgot code?" link**: `<Link>` was nested inside `<label>` (invalid HTML — browser strips interactive elements from labels). Moved to sibling `div.auth-field-labelrow` flex wrapper.

---

## [0.4.4] — 2026-04-21

### Changed
- **Landing CTA flow**: all primary CTAs (`enter-btn`, hero, case cards, final CTA) now point to `/auth/register` instead of `/sessions`.
- **Auth redirect on landing**: authenticated users visiting `/` are immediately redirected to `/sessions` server-side (no flash).

---

## [0.4.3] — 2026-04-21

### Added
- **Password reset flow**: `POST /api/auth/forgot-password` + `POST /api/auth/reset-password` endpoints; `/auth/forgot-password` and `/auth/reset-password` pages in noir style. DB migration adds `reset_token` / `reset_expires` columns to `users`.
- **Noir email templates**: `email.ts` fully redesigned — paper-card on ink background, blood-red button shadow (`border-bottom/right` trick for email client compat), typewriter labels. Covers verification and password reset emails.
- **"Forgot code?" link** on login page pointing to `/auth/forgot-password`.

---

## [0.4.2] — 2026-04-21

### Changed
- **Auth pages redesign**: Login, Register, and Verify pages now match the noir-dossier landing aesthetic — paper-textured dossier card with torn top edge, typewriter form labels, bottom-border inputs, blood-red stamp decorations, `btn-primary`-style CTA button. All three pages wrapped in shared `auth/layout.tsx` that loads the same 4 noir fonts and `landing-root` CSS variables.

---

## [0.4.1] — 2026-04-20

### Changed
- **Landing promoted to `/`**: noir-dossier landing is now the public homepage; session list moved to `/sessions`.
- **`/sessions` requires auth**: unauthenticated users are redirected to `/auth/login`; after login, redirect goes to `/sessions`.
- All internal back-links updated (`admin`, `GameChat`, `auth/login`) to point to `/sessions` instead of `/`.

### Removed
- `src/app/design-lab/` directory — all design-lab routes deleted from staging.
- `src/components/SessionListConceptA.tsx` — unused concept component deleted.

---

## [0.4.0] — 2026-04-20

### Added
- **Noir landing i18n + fixes**: EN/UA/ES language switcher, improved testimony readability (bright paper `#f2e6cb`, no noise overlay), expanded case file hooks with plot setup and replayability labels, client-side lang toggle in topbar.
- **Noir-detective landing (design-lab)**: new `/design-lab/landing` route with an isolated layout and full noir aesthetic — Special Elite / Playfair / IM Fell English / UnifrakturMaguntia typography, film-grain + vignette overlays, dossier-card hero, whisper ticker, six exhibits, procedure, case-file gallery (Haunting / Last Telegram / teaser), sworn testimony, final wax-seal CTA. Pure CSS — no external imagery.
- **Gemini implicit cache toggle**: admin setting `gemini_cache_enabled` (OFF by default). When ON — `systemInstruction` holds only `ruleset + static` (stable prefix); `dynamic` state is injected as a synthetic first user/model message pair in conversation history, enabling Gemini 2.5 Flash implicit caching (~75% token discount on ~1500 tokens/req). Debug log includes `geminiCacheMode: 'split'|'combined'` for A/B comparison.

### Changed
- **Campaigns disabled temporarily**: campaign creation bypassed server-side until mechanics are fixed (ANT-77..ANT-81). All sessions are one-shot regardless of scenario config.
- **The Last Telegram → one-shot**: `sessionConfig.isCampaign` set to `false`.

### Fixed
- **"Roll 1 or less" narrative bug**: ruleset prompt now instructs AI not to request rolls for skills absent from the player's list and never set threshold < 10 in `[SET_PENDING_ROLL]`.
- **Debug log deduplication**: removed redundant `systemPrompt` field from Gemini `saveMessageDebug` (was duplicating ruleset + static + dynamic).

---

## [0.3.33] — 2026-04-20

### Changed
- **Campaigns disabled temporarily**: campaign creation is bypassed server-side until mechanics are fixed (ANT-77..ANT-81). All new sessions are one-shot regardless of scenario config.
- **The Last Telegram → one-shot**: `sessionConfig.isCampaign` set to `false` in scenario file.

---

## [0.3.32] — 2026-04-20

### Added
- **Gemini implicit cache toggle**: нова адмін-опція `gemini_cache_enabled` (OFF за замовчуванням). При ON — `systemInstruction` містить тільки `ruleset + static` (стабільний префікс), `dynamic` переноситься як перша пара повідомлень у conversation history. Це дозволяє Gemini 2.5 Flash implicit caching (~75% знижка на ~1500 токенів/запит). Debug-лог отримав поле `geminiCacheMode: 'split'|'combined'` для порівняльного тестування.

---

## [0.3.31] — 2026-04-20

### Fixed
- **"Roll 1 or less" narrative bug**: додано правило до ruleset-блоку промпту (обидві мови) — AI не запитує кидки по навичках, яких немає в списку гравця, і ніколи не встановлює поріг < 10 у тегу `[SET_PENDING_ROLL]`. Замість цього описує наративний провал або пропонує суміжну навичку.
- **Debug log cleanup**: прибрано поле `systemPrompt` з `saveMessageDebug` для Gemini-сесій — воно дублювало `ruleset + static + dynamic`.

---

## [0.3.30] — 2026-04-20

### Fixed
- **NPC деталі накопичуються під час гри (ANT-70)**: додано новий AI-тег `[NPC_UPDATE:Name:relation:notes]`. Кіпер тепер може фіксувати відкриті деталі про NPC (мотив, поведінка, секрет) після кожної взаємодії. Нотатки накопичуються в `world_state.npcDetails` і відображаються в CaseFiles → Персонажі виділеним текстом. Dynamic block промпту тепер включає `npcDetails` щоб AI знав що вже відомо. Summarize-цикл Haiku захищений від очищення нотаток.

---

## [0.3.29] — 2026-04-19

### Changed
- **Довше structured intro (ANT-60)**: `introInstruction` у `prompts.ts` переписано під чітку 4-5-абзацну структуру (сцена → час/місце → NPC/деталі → сюжетний гачок з `**bold**` підказками → опційний перехід) і таргет 700-1100 символів. Intro-шлях тепер запитує більший token-бюджет: Gemini `maxOutputTokens: 1400`, Claude `max_tokens: 1400` (звичайні відповіді лишились 900).

---

## [0.3.28] — 2026-04-19

### Fixed
- **DiceRoller не зʼявлявся для Library Use (ANT-69)**: regex для парсингу `[SET_PENDING_ROLL]` використовував `([^\]]+)` для поля context, що вимагає мінімум один символ. Якщо LLM генерував тег з порожнім або відсутнім context, regex не матчив — `pendingRollResult` не встановлювався і DiceRoller не зʼявлявся. Fix: context тепер повністю опціональний (`(?::([^\]]*))? ` + fallback `''`).

---

## [0.3.27] — 2026-04-19

### Fixed
- **Битий placeholder dynamic image, який "полагоджувався" наступного дня (ANT-66)**:
  - **Головний root cause (виявлено після першої спроби)**: Next.js 16.2 standalone режим кешує список файлів `public/` при старті сервера. Рантайм-згенеровані картинки (`/public/scenarios/dynamic/HASH.jpg`) фізично лежать на shared volume, але HTTP-запит до `/scenarios/dynamic/*.jpg` повертає 404 до наступного рестарту контейнера. Звідси "наступного дня" (після деплою/рестарту) картинка "з'являлась".
  - **Fix**: додано Next.js `rewrites()` у `next.config.ts`: `/scenarios/dynamic/:hash.jpg` → `/api/image/file/:hash`. Новий API-роут `src/app/api/image/file/[hash]/route.ts` читає файл із `process.cwd()/public/scenarios/dynamic/` у рантаймі. URL у DB (`sessionImages`) лишаються у форматі `/scenarios/dynamic/HASH.jpg`, старі картинки теж обслуговуються через новий handler.
  - **Супутній fix** (PATCH reliability, знайдений першим): `GameChat.tsx` — `persistSessionImages` з retry × 3 + exponential backoff; `handleUrlGenerated` ідемпотентний; `DynamicImage` self-heal при наявності `url` prop; error placeholder з кнопкою `↻ Спробувати ще раз`.
  - **Image API resilience**: `/api/image` Gemini помилки (не-429) і "no image in response" fallback на Pollinations замість 502.
---

## [0.3.26] — 2026-04-19

### Fixed
- **NPC-тег hygiene (ANT-67)**: секцію `## ОЗВУЧКА NPC` / `## NPC VOICE` розширено чіткими правилами — всередину `[NPC:...]...[/NPC]` йде лише пряма мова; жести, погляди, ремарки виносяться в narration перед тегом; одна репліка = один тег.
- **Кіпер озвучував гравця як NPC (ANT-71)**: `/api/ai/route.ts` тепер перед `parseSegments` та auto-register зрізає обгортку `[NPC:<PlayerName>]...[/NPC]`, якщо ім'я у тегу збігається з іменем будь-якого гравця (partial match) — внутрішній текст зберігається у narration. Це прибирає фантомні NPC-бульбашки з іменем гравця та запобігає додаванню гравця у `npcRelations`. Prompt також тепер явно забороняє загортати слова гравців у `[NPC:]`.

---

## [0.3.25] — 2026-04-19

### Added
- **Admin debug tools (ANT-74)**: для ролі `admin` додано два інструменти діагностики Кіпера:
  - **Export chat log** — кнопка у settings drawer сесії (тільки admin). Завантажує повний транскрипт у Markdown, з метаданими сесії та raw `content` кожного повідомлення (всі теги збережені).
  - **Per-message debug** — іконка `🐛 debug` під кожним повідомленням Кіпера (тільки admin). Відкриває модал із JSON: система (ruleset/static/dynamic блоки), історія, що пішла у LLM, сирий output (склеєний, до парсингу тегів), `finishReason`, `usage`, `model`, `provider`. Підтримка copy-to-clipboard і `.json` завантаження.
- Нова таблиця `message_debug` (міграція в `initializeSchema`). Запис у неї відбувається fire-and-forget після `done` SSE-евенту, час відповіді Кіпера не збільшується. Дані доступні лише для повідомлень, створених після деплою фічі.
- Endpoints: `GET /api/admin/sessions/[id]/export` (markdown), `GET /api/admin/messages/[id]/debug` (JSON). Обидва перевіряють `role === 'admin'` у JWT → інакше 403.

---

## [0.3.24] — 2026-04-19

### Fixed
- **Обрив intro/відповідей Keeper на Gemini (ANT-58)**: Gemini 2.5 витрачав `maxOutputTokens` на приховані "thinking" токени, лишаючи на видимий текст ~30-40 токенів → `finishReason=MAX_TOKENS` при коротенькій відповіді. `callGeminiChat` тепер передає `thinkingConfig: { thinkingBudget: 0 }`, вимикаючи reasoning для game chat. Narrative output більше не обрізається.

### Changed
- **Gemini діагностика (ANT-58/60, Фаза 1)**: `callGeminiChat` у `/api/ai` тепер логує `finishReason`, `safetyRatings`, `promptFeedback.blockReason`, `thoughtsTokenCount`, довжину та межі тексту для intro-запитів, коротких відповідей (< 200 символів) і будь-якого не-`STOP` фінішу.

---

## [0.3.23] — 2026-04-18

### Changed
- **Ruleset-driven stats (ANT-63)**: DELTA-контракт і рендеринг статів перероблено на ruleset-driven. Player `stats` map тепер canonical source; legacy HP/SAN/LCK поля лишаються як backward-compat dзеркало. `StatsBar`/`CaseFilesPanel` і keeper-prompt генерують stat-лінію з `RULESETS[…].stats`, тому non-CoC системи підтримуються end-to-end.
- **Localized keeper prompt (ANT-64)**: коли сесія `language='en'`, весь системний prompt (plot guardrails, inventory/stat/image/location/NPC/completion sections, dice rules для CoC 7e та Kids on Bikes, intro instruction) тепер повністю англійською. Tag syntax незмінний.

### Fixed
- **Multi-action attribution (ANT-61)**: `/api/ai` більше не додає додатковий `[Name]:` префікс над уже відформатованим multi-player batch від клієнта, тому кіпер коректно адресує реплики по гравцях.
- **Double item consumption (ANT-62)**: сервер став єдиним authoritative джерелом inventory; клієнтське подвійне списання по `pendingItemUsesRef` прибрано. Одна дія тепер списує рівно 1 заряд, 1-use предмети зникають вчасно, не раніше.
- **Keeper voice consistency (ANT-36)**: Gemini TTS prefetch cache тепер ключується не лише по тексту, а й по narrator voice та segment layout, тому різні репліки більше не можуть випадково перевикористати чужий cached audio. OpenAI fallback також примусово тримає один keeper voice незалежно від message-level `voiceStyle`.
- **Claude response truncation (ANT-40)**: у streaming path для `/api/ai` текст відповіді тепер накопичується з усіх `text_delta` і зберігається як source of truth. Це прибирає кейс, де в persisted message лишався лише перший Anthropic content block, а решта відповіді відпадала посеред речення.
- **Dynamic image requests (ANT-38)**: коли гравець прямо просить щось показати, `/api/ai` тепер додає окрему image-request instruction у prompt, яка змушує Keeper вставити рівно один `[IMAGE:type:short English description]` для найрелевантнішого візуального обʼєкта або сцени.

---

## [0.3.22] — 2026-04-18

### Changed
- **Session completion UX (ANT-39)**: верхню active-session плашку прибрано. Замість неї статус сесії тепер показується компактними тегами біля назви та локації, а ручне завершення лишається тільки в settings як дострокове закриття.

### Fixed
- **Keeper-triggered completion (ANT-39)**: AI prompt/API flow тепер підтримують фінальні теги `[COMPLETE_SESSION]` та `[FINISH_EVENING]`, щоб Кіпер міг завершити сесію або вечір кампанії у природному фіналі без окремого in-flow CTA.
- **Completion analytics (ANT-39)**: у БД та адмінці тепер окремо видно нормально завершені сесії і сесії, закриті достроково.

---

## [0.3.21] — 2026-04-18

### Fixed
- **Scenario list refresh (ANT-44)**: адмінський `Scenario List` тепер показує всі сценарії з файлового сховища, навіть якщо по них ще немає session/cost stats, і оновлюється одразу після успішного save в генераторі.

---

## [0.3.20] — 2026-04-18

### Fixed
- **Lint cleanup (ANT-57)**: прибрано застарілі warnings у `src/app/api/ai/route.ts` після попередніх рефакторів. Поведінка не змінена; targeted lint по файлу тепер чистий.

---

## [0.3.19] — 2026-04-18

### Changed
- **Scenario generator save flow**: `Save` в адмінському генераторі тепер одразу запускає static image + ambient materialization і повертає явний статус по кожному етапу, замість “тихого” запису JSON без end-to-end feedback.

### Fixed
- **Scenario materials generation (ANT-45)**: save-route більше не падає всім запитом через одну asset-помилку. Static images та ambient обробляються окремо, а partial failures повертаються в UI як diagnostics.
- **Ambient runtime sync (ANT-41)**: після `[LOCATION]`/`[NEW_LOCATION]` сервер тепер одразу синхронізує `currentLocationGroup` з реальною новою локацією і віддає `ambientFile` для кожного переходу, щоб loop не губився через застарілий group-tracking.

---

## [0.3.17] — 2026-04-18

### Added
- **Ambient audio pipeline (ANT-30)**: `src/lib/ambient.ts` + `POST /api/scenarios/[id]/ambient` — ElevenLabs-based ambient генерація для static scenario locations/groups під час materials flow. Результат зберігається в shared `public/scenarios/<scenario>/ambient/` і записується в `ambientFile` у `scenario.json`.

### Changed
- **Runtime ambient resolution**: `src/app/api/ai/route.ts`, `src/app/session/[id]/page.tsx`, `src/components/GameChat.tsx` більше не конструюють URL з `locationId` — читають `ambientFile` зі сценарію (в т.ч. після reload).
- **Scenarios refresh**: оновлено `the-haunting` і `the-last-telegram` під новий контракт; попередні версії заархівовано в `scenarios/archive/2026-04-18/`. Тестовий `the-last-cup.json` прибрано з активних сценаріїв.

### Fixed
- **Post-deploy verification (ANT-23)**: генератор успішно відпрацював на проді з Opus 4.7 → fallback Gemini 2.5 Pro pipeline. Фікс підтверджено живим запуском.

---

## [0.3.16] — 2026-04-18

### Fixed
- **Scenario generator (ANT-23)**: перестав падати на великих сценаріях. Raised `max_tokens` 10 000 → 32 000 і переведено primary-модель на Claude Opus 4.7 з prompt caching на system prompt (~90% економії input на повторних викликах). Додано fallback на Gemini 2.5 Pro з `responseMimeType: application/json`, якщо Opus впав (timeout / parse error / 5xx).
- **Scenario generator — JSON parsing**: шукаємо text-блок у відповіді (а не припускаємо `content[0]`), знімаємо markdown fences надійнішим regex, на парсі-фейлі витягаємо підрядок від першого `{` до останнього `}`. Сервер логує `stop_reason` + `input/output_tokens`.
- **Scenario generator — timeouts**: `/api/admin/generate-scenario` тепер `runtime: 'nodejs'` + `maxDuration: 300`, щоб довга генерація не отримувала HTML 504 від reverse proxy (що давало `SyntaxError: Unexpected token '<'` у клієнта).
- **Scenario generator — Opus streaming**: Opus-path переведено на Anthropic streaming API, тому великі сценарії більше не падають у fallback на Gemini через SDK-помилку `Streaming is required for operations that may take longer than 10 minutes`.
- **Scenario provenance labels**: збережені generated scenarios тепер мають `generatedBy` metadata (`provider/model/fallbackFrom`), а в admin `Scenario List` з’явилась колонка `Source` з мітками `Opus`, `Gemini`, `Claude` або `legacy`.
- **Scenario generator UI**: клієнт парсить тіло як текст і акуратно показує HTTP-статус + перші 500 символів, якщо відповідь не JSON. Додано meta-рядок (`provider`, `model`, `input/output tokens`, `fallback`) над згенерованим JSON.

### Changed
- **Docs**: шляхи `/opt/apps/cthulhu` / `cthulhu-prod` у `CLAUDE.md`, `AGENTS.md`, `PROJECT_CONTEXT.md` замінено на актуальні `/opt/apps/barri` (prod), `/opt/apps/barri-dev` (staging) та `/opt/apps/shared_data/{scenarios,public/scenarios}` (shared volume). Команди деплою приведено у відповідність.

---

## [0.3.15] — 2026-04-17

### Fixed
- **Stale version badge**: футер на головній більше не зашитий на `v0.2.0` — версія тепер читається з `package.json` (`import { version }`), і `package.json` піднято до актуальної (ANT-29). Наступні релізи підсвічуватимуться автоматично при бампі версії.

---

## [0.3.14] — 2026-04-17

### Fixed
- **Dynamic image fullscreen**: `DynamicImage` fullscreen overlay now renders via `createPortal` to `document.body`, escaping the transformed sidebar wrapper that was trapping the preview inside the sidebar for sessions with dynamic session images.

---

## [0.3.13] — 2026-04-17

### Changed
- **Linear workflow finalization**: `LINEAR.md` перетворено на єдине джерело правди для Claude/Codex з фінальним lifecycle, mandatory pre-review checklist, `small-task` критеріями та review comment шаблоном.
- **Linear access policy**: закріплено режим **API-only** (`LINEAR_API_KEY`) без MCP/OAuth fallback у `LINEAR.md`, `AGENTS.md`, `CLAUDE.md`.
- **Docs sync**: `PROJECT_CONTEXT.md` приведено до фактичного статусу `Ready for deploy` (було `Ready for Deployment`).

---

## [0.3.12] — 2026-04-17

### Fixed
- **CaseFiles sidebar**: fullscreen preview for static scenario images now opens outside the transformed sidebar wrapper, so it covers the full viewport on mobile and desktop (ANT-24).

---

## [0.3.11] — 2026-04-17

### Changed
- **Docs sync**: `AGENTS.md` доповнено окремим розділом `Codex-Specific Rules` для Linear workflow та пріоритету MCP/plugin над API.

---

## [0.3.10] — 2026-04-17

### Changed
- **Docs sync**: `AGENTS.md` приведено у відповідність до фактичної структури проєкту та `LINEAR.md`; додано коротку карту репозиторію й зафіксовано Linear MCP/plugin як preferred path.

---

## [0.3.9] — 2026-04-17

### Changed
- **Gemini TTS pricing**: модель білінгу змінено з per-char на per-token з окремими цінами на input ($0.50/M tok) і output ($2.00/M tok). Pricing editor показує TTS поряд з LLM у секції "Per token" (ANT-27).
- **Admin → Usage**: input/output для TTS тепер показуються в токенах ("N tok"); старі записи — з префіксом "~" (ANT-27).

---

## [0.3.8] — 2026-04-17

### Changed
- **Admin → Usage tab**: нова секція "By Scenario" з кількістю сесій, завершеннями, середньою вартістю та загальними витратами по кожному сценарію (ANT-26).
- **Admin → Scenarios tab**: "Scenario List" тепер показує лише session stats (без вартості) (ANT-26).
- **Admin → Usage → By Model**: колонка Input тепер коректно показує `chars` для TTS та `input_tokens` для image; колонка Output для TTS — формат "N tok / N ch" (ANT-27).
- **Admin → Settings → Model Pricing**: Gemini image переміщено в секцію TTS/Image/STT; TTS-моделі показують input price в $/1M tok форматі (ANT-27).

---

## [0.3.7] — 2026-04-17

### Added
- **Admin → Scenarios tab**: таблиця зі статистикою всіх сценаріїв — кількість сесій, завершень (з відсотком), середня кількість повідомлень, середня та загальна вартість (ANT-25, ANT-26).

### Fixed
- **Usage tracking**: тепер зберігаються output tokens для Gemini image generation (`totalTokenCount - promptTokenCount`) — раніше трекувались лише input tokens (ANT-27).

---

## [0.3.15] — 2026-04-17

### Added
- **Ambient audio generation (Phase 10)** — додано `POST /api/scenarios/[id]/ambient`, який генерує seamless ambient loop-и через ElevenLabs для `locationGroups` сценарію, зберігає `.mp3` у shared VPS storage і записує `ambientFile` назад у `scenario.json`.

### Changed
- **Ambient playback runtime** — ігровий клієнт більше не вгадує шлях як `/sounds/<locationId>.mp3`, а використовує фактичний `ambientFile` із сценарію. Це вирівнює runtime з `locationGroups` і дає коректне відновлення ambient після reload.
- **Session startup materials flow** — під час старту сесії ambient generation тепер тригериться поруч із генерацією статичних scenario materials, але тільки для статичних сценарних локацій. Для dynamic locations автоматичну генерацію поки не вмикаємо.
- **Scenario generator admin UI** — підказку `Phase 10` прибрано; тепер UI пояснює, що ambient генерується пізніше на етапі scenario materials generation.
- **Canonical scenarios refreshed** — `the-haunting` і `the-last-telegram` перезібрані під новий generator contract: `rolePresets`, повний `briefing`, soundPrompt на static locations, коректні `supportedRoles/defaultRoles`, нові `variants` та розширений clue/event structure.
- **Scenario archive cleanup** — попередні версії активних сценаріїв перенесено в `scenarios/archive/2026-04-18/`, а тестовий `the-last-cup` прибрано з активного набору.

---

## [0.3.6] — 2026-04-17

### Changed
- **Docs: `LINEAR.md`** — синхронізовано з фактичною структурою проекту Linear: додано Codex ID, всі 11 workflow-станів (включно з `Ideas`, `Improvements`, `AI Improvements`, `Canceled`, `Duplicate`), нові лейбли `Bug`/`Improvement`/`Feature`. Виправлено назву стану на `Ready for deploy` (було `Ready for Deployment`). Додано fallback-доступ через `LINEAR_API_KEY` з `.env` для read-only запитів.

---

## [0.3.5] — 2026-04-16

### Added
- **Staging Environment** — створено ізольоване середовище розробки `staging.barrigame.es` на порту `3001` (папка `/opt/apps/cthulhu`).
- **Shared Storage Strategy** — впроваджено спільну папку `/opt/apps/shared_data` для сценаріїв та асетів. Це запобігає дублюванню генерацій та витрат на API при спільній базі даних.
- **Ready for Deployment** — новий стан у Linear для керованого Пром-деплою.
- **Linear API Integration** — повна підтримка роботи з Linear через токен (аккаунт Claude). Робота ведеться виключно в проекті **Barri** (`ffeca0b2-16b3-4d2e-a7e6-0181ea2e991c`).

### Changed
- **Git Branching Strategy** — перехід на `staging` як основну гілку розробки. Мердж у `main` лише для деплою на прод.

---

## [0.3.4] — 2026-04-15

### Added
- **Admin panel tabs** — адмінка розбита на 4 вкладки: Users / Usage / Scenarios / Settings (`AdminTabs.tsx`)
- **Usage tab: period filter** — фільтр по periodу для таблиць моделей та акаунтів: Today / Week / Month / All / Custom date
- **Usage tab: sessions** — розширена таблиця сесій: кількість гравців, повідомлень (з кіпером), avg output/input токенів, expandable model breakdown
- **Usage tab: accounts** — нова секція акаунтів з period filter та expandable деталями по моделях
- `costTracker.ts`: `Period` тип, `getSessionBreakdownEnhanced()`, `getAccountsBreakdown(period, date?)`, оновлено `getModelBreakdown(period, date?)`
- `api/admin/costs`: підтримка `?breakdown=sessions-enhanced`, `?breakdown=accounts`, параметрів `period` та `date`

---

## [0.3.3] — 2026-04-15

### Changed
- **Scenario generator** — перемкнено з `claude-opus-4-6` на `claude-sonnet-4-6`. Економія ~$0.40 за генерацію (з ~$0.50 до ~$0.10). Якість структурованого JSON-виводу аналогічна.

---

## [0.3.2] — 2026-04-15

### Changed
- **Scenario generator — rolePresets** — генератор тепер продукує `rolePresets[]` у кожному сценарії: тематичні ролі зі своїми навичками, інвентарем (включно з унікальними предметами) та бекграундом з ПЕРКОМ. `supportedRoles` і `defaultRoles` посилаються на id з `rolePresets`. `max_tokens` підвищено до 10000.
- **SCENARIO_GUIDE.md** — оновлено секцію 14 з повною документацією `rolePresets`.

---

## [0.3.1] — 2026-04-15

### Added
- **Scenario generator UI** — нова секція в адмін-панелі (`/admin`). Форма для генерації сценарію: назва EN/UK, premise, era, складність, мова, к-ть гравців, режим кампанії. Після генерації — перегляд JSON, кнопки "Copy JSON" та "Save to scenarios/". Зберігає файл через `POST /api/admin/generate-scenario/save`.
- Disabled checkbox "Generate ambient audio" з підказкою Phase 10 — задає очікування для майбутньої фічі.

---

## [0.3.0] — 2026-04-15

### Added
- **Scenario generator** — `POST /api/admin/generate-scenario` (admin-only). Приймає параметри сценарію, викликає `claude-opus-4-6`, повертає повний валідний JSON з усіма полями.
- **Scenario variants** — поле `variants: ScenarioVariant[]` у сценарії. При створенні сесії обирається випадковий варіант (різна стартова локація + `introHint` для Кіпера). Дозволяє перегравати сценарій з різними точками входу.
- `the-haunting.json` отримав 2 варіанти: "Стандартний" (офіс детектива) і "Відразу в справу" (одразу біля будинку).
- `SCENARIO_GUIDE.md` — нова секція про `variants`.

---

## [0.2.14] — 2026-04-15

### Removed
- **Панель гравців над чатом** — `StatsBar` прибрано з верхньої частини чату. Статистика доступна через сайдбар → вкладка «Гравці». Більш атмосферно — HP/SAN не маячать постійно перед очима.

---

## [0.2.13] — 2026-04-15

### Changed
- **Keeper prefix — умовна поведінка:** при 3+ гравцях Keeper використовує `Ім'я:` (без дужок) на початку абзацу коли адресує конкретного гравця. При 1–2 гравцях — без префіксу.

---

## [0.2.12] — 2026-04-15

### Fixed
- **Keeper не запускає кубики** — `[SET_PENDING_ROLL:]` тепер описаний як обов'язковий крок для КОЖНОГО кидка. Старі секції "Формат кидка" і "Кидки з наслідками" злито — усунено двозначність між текстовим форматом і тегом.

---

## [0.2.11] — 2026-04-15

### Added
- **Situational locations** — LLM може створювати нові локації тегом `[NEW_LOCATION:id:Назва:Опис]`. Зберігаються у `world_state.dynamicLocations`, відображаються правильно при перезавантаженні. Ambient аудіо не генерується. При повторному переході — `[LOCATION:id]` як для звичайних локацій.

---

## [0.2.10] — 2026-04-15

### Fixed
- **Location display shows "Акт 1" after transition** — LLM вигадував нові location ID замість використання існуючих. Додано перелік усіх доступних ID в інструкцію `[LOCATION:]` у системному промпті. UI fallback тепер показує відформатований ID замість "Акт 1" якщо назва не знайдена.

---

## [0.2.9] — 2026-04-15

### Fixed
- **Dynamic image re-generation on reload** — зображення `[IMAGE:...]` більше не перегенеровуються при заході у стару сесію. URL зберігається у `world_state.sessionImages` під реальним DB message ID (повертається у `done` event). При перезавантаженні `DynamicImage` знаходить URL у `sessionImages` і відображає збережений файл без запиту до Gemini.
- **`?json=true` параметр для `/api/image`** — повертає `{ url }` замість файлового буфера для client-side збереження URL.

---

## [0.2.8] — 2026-04-15

### Fixed
- **This page couldn't load (SessionList Crash v2)** — виправлено помилку, коли React падав після першого ходу гри через неправильне збереження `players` у БД у вигляді строки замість JSON («s.players.map is not a function»). Виправлено формування запиту в `postgres.js` та додано graceful parsing на клієнті для сумісності з вже пошкодженими сесіями в БД.
- **This page couldn't load (SessionList Crash)** — виправлено помилку "This page couldn't load" при заході на головну сторінку з простроченим токеном авторизації. Раніше компонент `SessionList` намагався розпарсити відповідь `401 Unauthorized` як масив сесій, що викликало крах React. Тепер відбувається коректний редірект на екран логіна.

---

## [0.2.7] — 2026-04-15

### Fixed
- **DiceRoller зависає після кидку** — `pendingRollResult` залишався в БД якщо LLM забував тег `[CLEAR_PENDING_ROLL]`. Тепер сервер примусово очищає його коли гравець надсилає чисте число (результат кидку)

---

## [0.2.6] — 2026-04-15

### Changed
- **Глобальні налаштування моделі та TTS** — вибір AI-моделі (Gemini Flash / Claude Sonnet) та TTS-провайдера (Gemini / OpenAI) перенесено з per-session ⚙️ панелі в адмін-панель (`/admin`). Налаштування зберігаються в БД і діють на всі сесії. За замовчуванням — Gemini 2.5 Flash + Gemini TTS
- **Спрощена ⚙️ панель** — прибрано вибір моделі та кнопку TTS. Лишилось: Пасив/Баланс/Актив, Автоозвучення, Ambient, Віртуальні кубики

---

## [0.2.5] — 2026-04-14

### Added
- **Language selection** — вибір мови гри (Українська / English) при створенні сесії. Кіпер відповідає відповідною мовою протягом усієї сесії (ANT-14)
- **Model pricing DB table** — ціни на API-виклики зберігаються в таблиці `model_pricing`, оновлюються через `PATCH /api/admin/pricing`. 7-денний in-memory cache. Виправлено ціни Gemini 2.5 Flash ($0.30/$2.50 замість $0.10/$0.40) (ANT-14)

---

## [0.2.4] — 2026-04-15

### Added
- **Dice Roller** — віртуальний генератор кидків d100 з анімацією slot-machine (два d10: десятки + одиниці). З'являється автоматично коли LLM запитує кидок. Тоггл "Віртуальні кубики" у ⚙️ панелі. Результат передається в LLM на підтвердження. Фізичний режим показує підказку з навичкою та порогом (ANT-13)

---

## [0.2.3] — 2026-04-14

### Added
- **Toggle switches** — перемикачі увімкнення/вимкнення Ambient та TTS прямо в ⚙️ панелі хедера (ANT-8)

### Fixed
- **Mobile panel** — overlay займає повний екран, кнопка закриття завжди видима (ANT-7)
- **NPC реєстрація** — NPC тепер авто-реєструються з тегів `[NPC:...]` одразу при появі в повідомленнях, без потреби перезавантажувати сесію (ANT-12)

---

## [0.2.2] — 2026-04-14

### Changed
- **Mobile sidebar** — панель «Матеріали справи» тепер прихована на мобільних пристроях. Відкривається кнопкою 📋 в хедері як overlay поверх чату (slide-in справа, backdrop для закриття). На десктопі (md+) поведінка без змін — завжди видима (ANT-7)

---

## [0.2.1] — 2026-04-14

### Fixed
- **TTS: голос НПС** — пошук NPC по частковому імені (AI може писати `[NPC:Ковальська]` замість повного `[NPC:Місіс Гаррієт Ковальська]`); тепер voice/gender правильно підтягуються навіть при скороченому тегу (ANT-11)
- **TTS: кубики** — прибрано озвучення деталей кидка `(1к100, треба X або менше)`, `[65]`, `Успіх N, провал 1кN SAN`; голос каже лише «Кинь Навичка», у чаті текст залишається повним (ANT-10)

---

## [0.2.0] — 2026-04-13

### Added
- **AI Provider Toggle** — перемикання між Claude Sonnet 4.6, Gemini 2.5 Flash та Gemini 2.5 Pro прямо під час гри (⚙️ в хедері)
- **NPC Speech Bubbles** — репліки персонажів відображаються окремими бульбашками зі своїм ім'ям замість єдиного блоку Кіпера
- **Multi-speaker TTS** — кожен NPC озвучується своїм голосом (Gemini multi-speaker API); нарація — голос Кіпера
- **TTS Prefetch** — Gemini TTS починає генеруватись одразу після AI-відповіді, без очікування на кнопку «озвучити»
- **Modern UI + Mobile** — viewport meta, bottom-sheet modal, збільшені touch targets, iOS input zoom fix, кастомний scrollbar
- **Версія** — відображається у заголовку SessionList

### Changed
- Хедер GameChat: кнопки TTS та ambient перенесені в collapsible ⚙️ панель; хедер тепер вміщається на мобільному
- Кнопки +/− статів: розмір 28×28px (були 20×20px)
- Textarea input: `font-size: 16px` (запобігає авто-zoom на iOS Safari)
- `CaseFilesDrawer` повністю на ширину на mobile

### Fixed
- iOS Safari auto-zoom при фокусі на input/textarea
- 300ms затримка тапу на мобільних браузерах

## [0.2.1] — 2026-04-17

### Added
- **Session completion flow**: новий endpoint `POST /api/sessions/[id]/complete` для завершення one-shot/campaign session з фінальним read-only станом.
- **Campaign finish evening**: кампанії тепер можна завершувати “по вечорах” — зберігається короткий summary, а наступна session створюється автоматично.
- **Player feedback**: rating `1–5` і коментарі до завершеної сесії зберігаються окремо в `session_feedback`.
- **Test scenario**: новий мікро-сценарій `Остання Чашка` (`the-last-cup`) для швидкого ручного тесту flow завершення.

### Changed
- **GameChat**: додані статусна панель, кнопки `Завершити сесію` / `Завершити вечір` / `Завершити кампанію`, completion modal і read-only review mode.
- **Session list**: сесії тепер розділені на active / paused / completed замість жорсткого показу тільки активних.
- **AI prompt flow for campaigns**: нові кампанійні сесії підхоплюють summaries попередніх вечорів через `campaignContext`.
- **Admin**: у списку всіх сесій тепер видно status і feedback; у статистиці сценаріїв — середній rating і кількість оцінок.

### Fixed
- Завершені сесії більше не приймають нові ходи через `/api/ai`.
- Completed sessions більше не зникають із користувацького списку та адмінки.
- Коментар до feedback в адмінці тепер можна розгорнути й прочитати повністю.

---

## [0.1.0] — 2026-03-01

### Added
- Базова механіка Call of Cthulhu 7e: HP, Sanity, Luck, навички, кубики, Pushed rolls, SAN checks
- AI Keeper на Claude Sonnet з кешуванням system prompt
- Text-to-Speech: OpenAI TTS + Gemini 2.5 Flash TTS з перемикачем
- Speech-to-Text (Whisper через OpenAI)
- Ambient звук локацій з fade in/out
- Генерація зображень (Gemini 2.5 Flash Image) — сцени, документи, артефакти
- Мультигравцевий режим (до 4 гравців) з чергою дій
- Інвентар з предметами та лічильником використань
- Матеріали справи: бріфінг сценарію, біографії гравців, галерея зображень
- Два сценарії: «Примарний Будинок» та «Останній Телеграм»
- Авто-збереження стану сесії в PostgreSQL
- Підсумовування world state кожні 20 повідомлень (Claude Haiku)

---

## [0.3.18] — 2026-04-18

### Changed
- **Scenario generator UI**: статус генерації тепер показує актуальну primary model (`Claude Opus 4.7`) замість застарілого hardcoded `Claude Sonnet`.
- **Scenario generator copy**: прибрано зайву згадку про ambient audio з JSON-generation екрана; materials/asset generation тепер описано як окремий крок.
- **Game session UI**: completion CTA прибрано з основної статусної панелі активної сесії, щоб завершення не пропонувалось посеред проходження сценарію.

### Fixed
- Ручне завершення сесії/кампанії більше не вискакує як primary action у центрі активної гри; доступ до нього перенесено в settings panel.

---

## [0.3.19] — 2026-06-08

### Added
- **Instant demo**: публічний `/demo` preview-case “The Archive Door” дозволяє спробувати Keeper loop без реєстрації: короткі дії, реакції Keeper, clues, d100-check і фінальна waitlist modal.
- **Waitlist capture**: після завершення демо або ліміту повідомлень користувач може залишити email для черги доступу.
- **Demo Keeper scenario**: instant demo тепер має окремий короткий сценарій “The Archive Door” і публічний Keeper endpoint, що використовує реальний Barri system prompt pipeline.
- **Locked public case cabinet**: лендинг показує один відкритий demo-файл і реальні існуючі сценарії як запечатані картки з `Access denied` та CTA на waitlist.

### Changed
- **Landing CTA**: основні кнопки з публічного лендингу тепер ведуть у instant demo замість форми реєстрації.
- **Instant demo AI**: scripted keyword-відповіді замінені на відповіді Keeper через `buildSystemPromptBlocks`, Gemini Flash і demo world state.
- **Launch intake**: `Enter Dossier`/final CTA ведуть напряму у waitlist, а `/auth/register` перетворено на waitlist-only форму без password/confirm полів.

### Fixed
- **Registration bypass**: direct `POST /api/auth/register` тимчасово закритий (`registration_closed`), щоб public launch доступ ішов тільки через waitlist.
- **Demo checklist**: прогрес у `/demo` більше не рухається від keyword-збігів у будь-якому тексті; чекбокси оновлюються тільки через явні Keeper progress tags або реальні state mutations.
- **Demo localization**: `/demo` отримав EN/UK/ES UI copy, language switcher і language-aware Keeper route.
- **Demo dice checks**: roll state тепер показується окремим d100 emulator panel замість suggested text actions.
- **Demo timeout**: preview timer збільшено до 15 хвилин, оформлено як обхід сторожа, а після timeout chat блокується без повторного відкриття модалки після закриття.
- **Demo localized intents**: основні EN/UK/ES демо-дії тепер надійніше приводять Keeper до відповідних scenario tags без повернення keyword-прогресу для будь-якого тексту.
- **Demo microcopy**: напис на дверях демо оновлено на “Відділ паранормальних справ” замість “справ, що відмовилися померти”.
- **Demo free-text flow**: тимчасово прибрано кнопки запропонованих дій над чатом, щоб користувачі писали власні ходи.
- **Admin usage**: usage dashboard тепер трекає anonymous instant-demo calls і показує окремий блок `Anonymous Demo` з сесіями, токенами та cost.
