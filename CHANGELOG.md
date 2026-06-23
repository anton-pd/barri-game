# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

---

## Unreleased

### Added
- **GitHub Actions auto-deploy for staging and production.** Pushes to `staging` now deploy `staging.barrigame.es`, pushes to `main` deploy `barrigame.es`, and the same workflow can be run manually with a target selector. Deploys use a restricted VPS SSH key that only permits the documented deploy commands.
- **Admin waitlist access console (ANT-180).** Admins can now see waitlist entries, lifecycle statuses (`waiting`, `invited`, `account created`, `active user`), invited/active percentages, and open access from the admin panel.
- **Invite-only account creation (ANT-180).** Opening waitlist access sends a localized invitation email (Ukrainian, Spanish, English fallback) with a secure registration link so invited users can create an approved account and enter Barri.
- **Launch asset pack for Product Hunt and itch.io (ANT-111).** Added public launch-ready thumbnails, gallery images, itch cover art, screenshots, and copy metadata under `public/launch-assets/` / `LAUNCH_METADATA.md`, so staging and production can serve the same publication assets.
- **Admin scenario library and delete controls (ANT-177).** Admins can now view live scenario files, inspect full scenario JSON, and delete scenarios from the shared runtime directory. Deletes also clear cached scenario assets when present.
- **New original noir horror scenario for rules testing (ANT-176).** Added `The Black Ledger` / `Чорна книга`, a one-shot playtest case with v2-style planning fields (`clueGraph`, `casePlanSeeds`, `npcHooks`, `finaleGates`, structured event completion criteria) while staying backward-compatible with the current runtime.

### Changed
- **Renamed the AI host from Keeper to Case Curator.** Public landing/SEO/demo copy, game-chat labels, completion text, admin headings, TTS speaker labels, and LLM-facing prompt instructions now use **Case Curator** / **Куратор справи** / **Curador del caso**. Internal compatibility names such as `keeperStyle` and `keeper_style` remain unchanged.

### Removed
- **Removed two legacy live scenarios from shared storage (ANT-177).** `barcelona-sagrada-mystery` and `the-haunting-v2-pilot` were removed from the staging/prod shared scenario catalog, along with their cached generated assets.

### Fixed
- **Email sender name.** Transactional emails now default to the `Barri Bureau` sender name instead of the old Keeper branding.
- **Empty AI replies from DeepSeek reasoning budget exhaustion (ANT-178).** Game turns now explicitly disable hidden reasoning for DeepSeek V4 Flash / OpenRouter pro requests, and the server rejects empty final content instead of saving a blank Case Curator message.
- **Mobile account menu clipping (ANT-179).** The compact sessions-page account menu now stays inside the phone viewport instead of being clipped by the mobile topbar.

## [0.5.10] — 2026-06-20

### Fixed
- **Cookiebot script was blocked / didn't load (ANT-171).** `next/script` with `strategy="beforeInteractive"` emitted the Cookiebot loader as a `<link rel="preload">` plus dynamic injection, which content blockers and browser heuristics treated differently from a normal install and blocked (`ERR_BLOCKED_BY_CONTENT_BLOCKER`) — so `window.Cookiebot` never appeared and no banner showed. Now rendered as a plain direct `<script>` in `<head>` (the official Cookiebot snippet). Also added a safety fallback: if the CMP still fails to load within 4s, the built-in first-party banner is shown so consent + analytics keep working.

## [0.5.9] — 2026-06-20

### Added
- **Cookiebot CMP for cookie consent (ANT-171).** Replaced the built-in consent banner with [Cookiebot](https://www.cookiebot.com/) (EU/GDPR-compliant CMP, free plan) on prod. PostHog now initializes only when Cookiebot's `statistics` consent is granted (and opts out on withdrawal). Prod-only via runtime-injected `COOKIEBOT_CBID` (script in `<head>`, `data-blockingmode="manual"`); staging / setups without a CBID fall back to the built-in banner so nothing breaks.

## [0.5.8] — 2026-06-20

### Added
- **PostHog first-party reverse proxy (ANT-170).** Analytics now route through `barrigame.es/ingest` (Next.js rewrites → PostHog EU ingestion + assets hosts) instead of hitting `*.posthog.com` directly, so adblockers (uBlock/Brave/AdGuard) can no longer block events. `posthog-js` uses `api_host: '/ingest'` + `ui_host`. Root cause confirmed from a real browser: posthog-js initialized (persistence cookie present) but ingestion requests were blocked.

## [0.5.7] — 2026-06-20

### Fixed
- **PostHog never sent events after consent (ANT-169).** The opt-out-by-default + `opt_in_capturing()` flow did not actually start capturing in posthog-js 1.39x — confirmed via a headless browser (no adblock): clicking "Дозволити" loaded config but fired zero capture requests. Reworked to **not initialize PostHog until consent is granted**, then `init()` + an immediate `$pageview`. Cleaner GDPR posture and events now flow.

## [0.5.6] — 2026-06-20

### Added
- **PostHog custom product events (ANT-169)** — client-side product events on top of ANT-168 for the scenario funnel: `session_created` (scenario/ruleset/roles/language), `ai_turn` (latency, provider, has_npc/has_image/truncated), `dice_roll` (skill/value/threshold/success), and `scenario_completed`/`finish_evening` (trigger/ended_early/message_count). Captured client-side via a `track()` helper (`lib/analytics.ts`) so events respect the consent banner, share one distinct_id with pageviews (funnels work), and stay prod-only automatically.

## [0.5.5] — 2026-06-20

### Added
- **PostHog product analytics (ANT-168)** — prod-only web + product analytics via PostHog EU Cloud. Runtime-injected API key (server `layout.tsx` → `PostHogProvider`), so staging and prod share one codebase but only the prod container sets `POSTHOG_KEY` and is ever tracked. Manual pageview capture on route change, GDPR consent banner (memory-only persistence + opt-out until the visitor accepts).

## [0.5.4] — 2026-06-15

### Changed
- **Game chat: emoji replaced with a cohesive line-icon set (ANT-163).** All decorative/UI emoji in the play screen (📋 ⚙️ 📍 🔈 🔊 ⬇ ▶ ⏸ ⚠ 🐛 🎒 ⚔ ➤ ← ✕ …) are now thin-stroke SVG icons (`Icon.tsx`) that inherit `currentColor`, so they read as part of the noir dossier instead of breaking it. The `🎲` dice-result marker stays in stored content (server contract) but renders as the dice icon.
- **Removed the voice (STT) button (ANT-165).** Hidden from the composer for now; `VoiceButton.tsx` is retained for later.
- **Restyled the send + finish buttons to match the UI (ANT-165).** The send button drops the odd blood-red offset shadow for a rectangular amber stamp consistent with the other controls; the back/icon buttons are rectangular; "Завершити вечір / кампанію" use the typewriter uppercase noir treatment (neutral ink for the evening, blood stamp for the terminal action).
- **Unified the investigator card in the dossier (ANT-166).** The player stats panel and the static "Слідчі" list were merged into a single investigator card per player inside the "Слідчі" dossier section, styled in the same paper-card language as the rest of the case file (stat bars + skills + inventory + active-player selection).

## [0.5.3] — 2026-06-15

### Changed
- **Dropped the Anthropic dependency from the app (ANT-167).** Scenario generation (`scenarioGenerator.ts`) now runs on **Gemini 2.5 Pro** (the previous Opus/Anthropic path was removed). Campaign close already ran on DeepSeek. A **DeepSeek** generation path was added behind an optional `provider` flag (with a Gemini/DeepSeek selector in the admin scenario generator) so we can A/B scenario quality (Gemini vs DeepSeek) and pick the default later.
- **Hardened the API-key build/env structure (ANT-167).** `ANTHROPIC_API_KEY` is removed from the `barri`/`barri-dev` services in `docker-compose.yml`. The app no longer reads it, so the long-standing footgun — the Claude Code shell exporting an empty `ANTHROPIC_API_KEY` that shadowed the `.env` value during Compose interpolation and silently shipped a blank key — can no longer occur. Rebuilds no longer need the `env -u ANTHROPIC_API_KEY` workaround. (The dev eval harness in `scripts/eval` still uses Anthropic and keeps the key in `.env`.)

## [0.5.2] — 2026-06-15

### Changed
- **Player stats panel moved to the dossier (ANT-166).** The HP / SAN / Luck bars and inventory (`StatsBar`) no longer sit at the top of the central chat column — they now live as a section inside the "Досьє справи" side panel, so the reading/chat area stays uncluttered. Cards stack vertically to fit the narrow rail. Active-player selection stays in sync with the composer rail. Note: on mobile the side panel is a bottom sheet, so stats are one tap away rather than always-on-screen.

## [0.5.1] — 2026-06-15

### Changed
- **Settings consistency — emojis removed (ANT-163).** Stripped decorative `✓`/`✗` glyphs from admin status/confirmation labels (KeeperSettings "Saved", AdminTabs verified/pending, PricingEditor, ScenarioGenerator) for a consistent text-only treatment.
- **Game-chat narrative font (ANT-164).** Replaced the hard-to-read italic `IM Fell English` (Latin-only) with **Lora** (SIL OFL, full Latin+Cyrillic) for the Keeper/narrative text, rendered upright. Scoped to the game chat only (`session/[id]` layout + `chat.css`); landing/auth/demo pages untouched.
- **Button style normalization (ANT-165).** Unified buttons across admin, sessions and game chat to a consistent rectangular shape (dropped mixed `rounded-xl`/`rounded-lg` radii). Toggle switches and panel/card containers keep their existing shapes (they are not buttons).

## [0.5.0] — 2026-06-15 — Production release

First consolidated promotion of the staging line to `main` (folds in `0.4.43`–`0.4.49`). Themes shipped in this release:

- **EU launch — legal / GDPR readiness:** Privacy Policy + Terms of Service pages, footer Legal links and a 16+/Terms/Privacy consent checkbox on the waiting-list form (ANT-155/156); self-service account deletion (Art. 17) and data export (Art. 20) at `/account` (ANT-159).
- **Game engine & dice hardening:** exhaustive DELTA/LOCATION tag application (ANT-118), summarizer no longer clobbers npcRelations / navigation state (ANT-117/68), random-event lifecycle ordering (ANT-124), dice-roll contract hardening + ruleset-aware rolls (ANT-119/120), `[ITEM:]` colon parsing (ANT-125), must-happen event tracking (ANT-148), split-tail prompt caching (ANT-126), NPC roster dead-lock fix (ANT-153), prompt tuning + EN localization (ANT-116, 143–147).
- **Chat UX / a11y / performance:** streaming tag & markdown sanitation (ANT-121/130), truncation recovery (ANT-129), failed-send retry (ANT-133), dice-result chip (ANT-134), humanized item/location/scenario labels (ANT-128/131), image crop fix (ANT-154), dialog semantics + focus trap (ANT-137), prefers-reduced-motion (ANT-138), login hydration guard (ANT-132).
- **Tooling & release gate:** model-matrix eval harness (ANT-140) and reactive-roll fixtures (ANT-149); waiting-list access gate + per-user daily cost cap (ANT-108).

Per-change detail is in the `0.4.x` entries below.

## [0.4.49] — 2026-06-15

### Added
- **Self-service account deletion and data export (ANT-159).** New "Дані та приватність" page at `/account` (linked from the email in the sessions header and the mobile menu) lets a signed-in user download all data tied to their account as a single JSON file (GDPR Art. 20) and permanently delete their account after confirming with their password (GDPR Art. 17). Deletion runs in a transaction and removes the user's game sessions, messages, campaigns, summaries, submitted feedback, and waiting-list entry; anonymized API-cost rows are intentionally retained. New endpoints `DELETE /api/account` and `GET /api/account/export`.

## [0.4.48] — 2026-06-13

### Added
- **Legal pages: Privacy Policy and Terms of Service (ANT-155 / ANT-156).** New `/privacy` and `/terms` static pages with a GDPR Art. 13 structure (data collected, legal basis, processors, international transfers, retention, cookies, data-subject rights, contact). Added a "Legal" column to the landing footer (uk/es/en) and a required consent checkbox ("I am at least 16 and accept the Terms and Privacy Policy") on the waiting-list / registration form — the submit stays disabled until it is checked. Page copy is a clearly-marked **DRAFT pending legal review**; processor/transfer specifics depend on the transfer audit (ANT-160).

## [0.4.47] — 2026-06-12

### Fixed
- **NPC dialogue bubbles and the Characters panel work again (ANT-153).** The Keeper now always sees the full scenario cast: met NPCs keep their full blocks (description + secrets), unmet ones are listed as a compact one-line roster. Previously only already-met NPCs reached the prompt, so the model never learned NPC names, never emitted `[NPC:]` tags, and nothing ever registered — speech landed in narration bubbles and the panel stayed empty. Added a few-shot `[NPC:]` example, a hardened checklist line, and a log-only server monitor for untagged direct speech.

## [0.4.46] — 2026-06-12

### Fixed
- **Images no longer cropped in chat (ANT-154).** Square (1:1) images generated in the chat now display at full size instead of being stretched horizontally and cropped into thin stripes. Changed `object-cover` to `object-contain` in DynamicImage and evidence cards, added explicit `maxWidth` / `maxHeight` constraints. Fullscreen modal already had correct styling.

## [0.4.45] — 2026-06-12

### Added
- **Must-happen event tracking (ANT-148).** The Keeper now marks scenario must-happen events as completed via a new `[EVENT_DONE:n]` tag against the numbered event list in the system prompt. Completed indices live in `world_state.completedMustEvents` (engine-owned — the summarize cycle can't overwrite them), and the dynamic prompt block shows a compact ✓/ahead status line so deep sessions neither repeat finished plot beats nor lose pending ones. Three new eval probes (positive / negative / no-repeat) gate the contract: DeepSeek direct 9/9, OpenRouter-Cloudflare 8/9.

## [0.4.44] — 2026-06-12

### Changed
- **Sessions page vignette removed.** The case-files list (available scenarios) no longer darkens screen edges with the heavy radial vignette from the global landing overlay — only the subtle colored smoke washes remain. Same approach as the earlier game-chat fix (ANT-115 follow-up).

## [0.4.43] — 2026-06-12

### Added
- **Reactive-roll eval probes (ANT-149 follow-up).** The eval harness gained five probes for the new reactive-roll contract: stealth-while-hiding, sudden physical danger, a chase, and an NPC about to spot a lie must all end in a `[SET_PENDING_ROLL]` with a fitting skill, plus one negative probe asserting a calm recap conversation produces no roll request at all (guard against roll spam from the cadence rule). Baseline on the staging prompt (3 passes × both DeepSeek tiers): physical danger 6/6, hiding 5/6, chase 3/6, lie detection 0/6 — the social trigger doesn't fire yet; no roll spam (6/6 clean).

## [0.4.42] — 2026-06-12

### Changed
- **Reactive roll triggers + roll cadence (ANT-149).** The CoC 7e dice rules now describe a second roll-trigger category — "the world acts on the player" (a threat may notice/catch/harm the character: someone searching while the player hides, a chase, falling debris, an NPC spotting a lie or a sneaking player) — with an explicit prohibition on resolving "did the threat notice/reach/hit the character" by narration alone. Added a second few-shot example showing a tense reactive scene that ends in a Stealth roll, a cadence guideline (~every 2nd–3rd meaningful action in a tense scene goes through a roll, never more than one [SET_PENDING_ROLL] per response, trivial actions still never roll), and one extra line in the pre-send tail checklist. Mirrored across Ukrainian and English. Prompt-contract only — no tag syntax, parsing, or server changes.

## [0.4.41] — 2026-06-11

### Changed
- **Keeper prompt tuned for DeepSeek (ANT-143…147).** A pre-send protocol checklist now sits right before the model's response point (hidden clues must be gated behind rolls, picked-up items must emit inventory tags, NPC speech must close its tags), a one-line-per-tag cheat sheet closes the system prompt, dice rules gained a worked example, and NPC secrets may only surface through successful rolls or real leverage. Engine temperature lowered to 0.7 after an A/B eval — better roll/tag discipline, prose unchanged.

## [0.4.40] — 2026-06-11

### Changed
- **Game engine moved to DeepSeek V4 Flash in two tiers (ANT-142).** Base tier (free/trial) uses the DeepSeek API directly; Pro tier (future paid) goes through OpenRouter pinned to Cloudflare for ~0.6s first token. Admin → Keeper Settings now switches the tier. Claude Sonnet and Gemini are no longer engine options — Gemini still powers image generation, voice and background world-state summaries.
- Cost tracking now bills cached prompt tokens at each tier's real cache-read rate instead of treating them as free.

### Removed
- "Gemini Implicit Cache" admin toggle — the split-prompt shape it controlled is now always on and engine-agnostic.
- Claude Haiku in campaign-evening summaries — replaced with DeepSeek (cheaper, now cost-tracked).

## [0.4.39] — 2026-06-11

### Added
- **OpenRouter TTFT/cache benchmark (ANT-142).** `scripts/eval/bench-openrouter.ts` compares DeepSeek direct vs OpenRouter provider pins. Winner: Cloudflare-hosted DeepSeek — first token in ~0.6s (8× faster than direct), 99% prompt-cache hits, unchanged Ukrainian prose quality.

## [0.4.38] — 2026-06-10

### Added
- **Tool-calling experiment arm in the model eval (ANT-141).** `--tools` mode replays the same probes with state mutations as tool calls instead of inline tags. Verdict: single-pass tool calling cannibalizes the narrative (empty replies next to tool calls) and does not improve tag compliance — inline tags + server fallbacks stay.

## [0.4.37] — 2026-06-10

### Added
- **DeepSeek V4 Flash as a selectable Keeper model (ANT-142).** Admin → Keeper Settings → AI Model now has a third, experimental option. Replies stream live; cost tracking accounts for DeepSeek prompt-cache discounts. Default provider unchanged (Gemini Flash).

## [0.4.36] — 2026-06-10

### Added
- **DeepSeek arm in the model eval (ANT-142).** `deepseek-v4-flash` via the OpenAI-compatible streaming API with cache-aware cost accounting; blocked on account balance (402) — code ready to run once topped up.

## [0.4.35] — 2026-06-10

### Added
- **Model eval harness (ANT-140).** `scripts/eval/run-eval.ts` replays real sessions against a model matrix (Sonnet 4.6, Haiku 4.5, Gemini Flash/Flash-Lite) and scores tag-protocol compliance, Ukrainian purity, latency and cost per turn, with an optional blind LLM judge. First run: Sonnet strongest on protocol, Haiku 4.5 ruled out, deep-history roll tags survive only on Sonnet (auto-inject fallback rescues the rest), Gemini implicit caching shows zero hits.

## [0.4.34] — 2026-06-10

### Fixed
- **Review pass over the engine/tag-protocol fixes (ANT-117…126, ANT-68, ANT-116, ANT-127).** Code review of all eleven In-Review engine tasks; three review findings fixed: a stale ANT-68-era unit test still expected the summarizer to overwrite `npcRelations` (contradicting ANT-117 — replaced with a test asserting the engine-owned field survives), the ANT-125 colon-in-description fix had no regression test (two cases added, including two `[ITEM]` tags in one reply), and `PROJECT_CONTEXT.md` still said `max_tokens: 900` for main turns after ANT-129 raised it to 1200.

## [0.4.33] — 2026-06-10

### Added
- **More room for the story on phones (ANT-139).** The player stats card now collapses to a single line on mobile — name plus compact HP/SAN/LUCK numbers — and the full bars, skills and inventory open on tap. Desktop layout unchanged.
- **Screen-reader and keyboard accessibility (ANT-137).** The new-session modal is a proper dialog (focus trap, Escape to close, focus returns to the trigger), the disabled "Відкрити справу" button now explains what's missing, icon buttons got aria-labels, and the chat announces new messages via `role="log"`.

### Changed
- **Background effects respect reduced-motion (ANT-138).** The film grain, ticker, lamp flicker and caret on the landing/auth/sessions pages stop animating when the OS asks for reduced motion — textures stay, movement (and the constant repaint cost on battery) goes.
- **Dice results land in the chat as a proper roll chip (ANT-134).** Confirming a roll now sends "🎲 Spot Hidden: 62 проти 70 — успіх" instead of a bare "62", styled as an amber (success) or red (failure) chip — readable in history and after reload.

## [0.4.32] — 2026-06-10

### Changed
- **Settings strip is labelled and fully Ukrainian (ANT-136).** The style pills now sit under a "Стиль Кіпера" caption, sound toggles under "Звук" (with "Ambient" → "Ембієнт"), and the dice toggle under "Кубики".

### Added
- **One-click retry after a failed Keeper turn (ANT-133).** A connection error no longer leaves a dead "Помилка зв'язку" bubble: the message is rolled back, your text returns to the input box, and a banner offers "↻ повторити".

### Fixed
- **Voice-over button reads naturally and reports failures (ANT-135).** Idle state is now "▶ озвучити" (was a confusing "↻"), and when audio can't load or play, the button briefly shows "⚠ не відтворилось" instead of failing silently.
- **Login no longer silently wipes the form when clicked too early (ANT-132).** Submitting before the page's JavaScript loaded triggered a native reload that cleared both fields; the button now stays disabled until the form is interactive.
- **Session cards show real names instead of internal ids (ANT-131).** The resume card on the sessions page printed "THE-HAUNTING · ELM_STREET_EXTERIOR"; it now resolves the scenario title and the current location's display name.
- **Keeper replies no longer stop mid-word at the token cap (ANT-129).** Main turns get more headroom (900 → 1200 tokens); when a reply still hits the cap, the server trims it back to the last complete sentence before saving, and the bubble shows a "⤷ продовжити" button that asks the Keeper to pick up where it left off.
- **No more literal `**` asterisks in the chat (ANT-130).** While a reply streamed, an opened bold marker showed as raw asterisks until its pair arrived — and stayed raw forever on token-truncated replies. The renderer now drops a half-received `*` at the buffer edge and the last `**` when unpaired, for live and persisted messages alike.
- **Inventory no longer shows raw technical ids as item names (ANT-128).** The Keeper occasionally emitted `[ITEM:0:case_file:…]` — and the player saw a literal "case_file" chip. The prompt now forbids id-shaped names in both languages, and the server parser de-uglifies any that slip through (`old_note` → "Old note").

## [0.4.31] — 2026-06-09

### Changed
- **PROJECT_CONTEXT.md synced with the engine (ANT-127).** Corrected max_tokens limits (900/1400/500), added the missing tags to the protocol table ([NPC_UPDATE], [CASE_PLAN], [COMPLETE_SESSION], [FINISH_EVENING]), documented multi-tag application order, textForDB stripping rules, engine ownership of npcRelations, and the casePlan/npcDetails/dynamicNpcs WorldState fields.
- **Gemini split-cache mode actually caches now (ANT-126).** The [SESSION STATE] turn moved from the start of contents to the end, right before the latest player message. Implicit caching matches a stable token prefix — with the always-changing dynamic block first, the cacheable prefix ended at systemInstruction; now it covers systemInstruction plus the append-only history. Side benefit: the current state and roll instructions sit adjacent to the model's response point instead of behind up to 30 history messages, which should reduce how often Gemini forgets [SET_PENDING_ROLL]. Debug snapshots label the layout as `split-tail`.

## [0.4.30] — 2026-06-09

### Fixed
- **Item descriptions with colons no longer break the [ITEM:] tag (ANT-125).** A Keeper description like "Записка з адресою: вул. Глибока 13" silently failed the parser — the narration said the player picked the item up, but inventory never got it. The description segment is now lazy-greedy, anchored by the trailing `:uses]`.

## [0.4.29] — 2026-06-09

### Fixed
- **Random-event lifetime follows the roll it spawned (ANT-124).** Event cleanup now runs after the dice force-clear and the roll-text fallback: a roll_event whose roll text lacked the tag keeps its event alive while the roll is synthesized, and a roll resolved via force-clear (LLM forgot [CLEAR_PENDING_ROLL]) releases its event in the same turn instead of blocking new events for one extra turn.

## [0.4.28] — 2026-06-09

### Fixed
- **Explicit-image detection no longer fires on bare nouns (ANT-123).** "I read the letter" / "check the map" / "I draw my revolver" used to force a mandatory [IMAGE:] tag (and an image-generation cost) because bare `letter`/`map`/`photo`/`image`/`draw` matched anywhere. Detection now requires show-intent verb phrases (показати / show me / can I see / what does X look like / draw me ...). Bonus: the Ukrainian patterns never matched at all before — JS `\b` word boundaries are ASCII-only — so "покажи лист" now actually triggers the visual request instruction.

## [0.4.27] — 2026-06-09

### Fixed
- **Optimistic message ID collision on multi-player queued sends (ANT-122).** User bubbles used ids `now + i` while the assistant bubble used `Date.now() + 1` — with 2+ queued actions in the same millisecond the ids collided and streaming text was appended into a player's bubble (plus duplicate React keys). Local ids are now namespaced (`local-<ts>-u<i>` / `local-<ts>-a` / `local-<ts>-intro`); the done event still remaps to the real DB id.

## [0.4.26] — 2026-06-09

### Fixed
- **Raw control tags no longer flash in the chat bubble during streaming (ANT-121).** SSE chunks stream raw model output, and tags arrive at the end of a reply — `[DELTA:{...}]`, `[CASE_PLAN:{...}]`, `[SET_PENDING_ROLL:...]` and partial tags at the buffer edge briefly showed before the done event replaced the text. The assistant-bubble display path now strips all complete data tags plus any trailing partial tag while streaming.

## [0.4.25] — 2026-06-09

### Fixed
- **Roll protocol is now ruleset-aware (ANT-120).** The `[SET_PENDING_ROLL]` reminder used to be appended to every prompt even for Kids on Bikes / D&D 5e, whose own dice rules contradict d100 roll-under — and the virtual DiceRoller would have rendered inverted success/fail verdicts. The reminder is now injected only for percentile rulesets, KoB and the placeholder ruleset block explicitly tell the Keeper to resolve rolls in plain text, and the server strips-but-ignores `[SET_PENDING_ROLL]` tags (and skips the text-fallback synthesis) for non-percentile rulesets so the d100 roller can never engage there. CoC behavior unchanged.

## [0.4.24] — 2026-06-09

### Fixed
- **Dice-roll contract hardening (ANT-119).** Four fixes to the roll loop: (1) the auto-inject fallback that synthesizes `[SET_PENDING_ROLL]` when the Keeper writes roll text without the tag now tolerates bold markdown and reworded parentheticals in both languages; (2) a roll result is attributed to the player the roll was set for (`pendingRoll.characterIdx`), not whoever's tab is active; (3) `[SET_PENDING_ROLL]` values are validated server-side against the actual character sheet — wrong player index falls back to the sender, a known skill's value is corrected to the sheet value (threshold follows when the LLM used the "threshold = value" convention, floored at 10); (4) a bare-number dice result no longer counts as a passive turn, so consecutive rolls stop falsely triggering the "players are silent" nudge.

## [0.4.23] — 2026-06-09

### Fixed
- **All Keeper tags are now applied, not just the first one (ANT-118).** Multiple `[DELTA:]` tags in one reply (e.g. separate damage for two players) all apply in order; `[LOCATION:]`/`[NEW_LOCATION:]` moves are processed in document order — every move counts as visited, every new location registers, and the *last* move becomes current (previously NEW_LOCATION always beat LOCATION regardless of order, and extra tags were silently discarded while still being stripped from the text).
- **Hyphenated situational location ids parse correctly.** `[NEW_LOCATION:]` id grammar now matches `[LOCATION:]` (`[\w-]+`).
- **Raw tags no longer leak into NPC/narration segments.** `[NEW_LOCATION:]`, `[COMPLETE_SESSION]`, and `[FINISH_EVENING]` are stripped from segment text (they could previously surface in fresh-response bubbles and multi-speaker TTS).

## [0.4.22] — 2026-06-09

### Fixed
- **Periodic summarizer no longer corrupts NPC relations (ANT-117).** Every 20 messages the Haiku world-state summary used to replace the whole `npcRelations` object with transcript-guessed IDs, wiping deterministic `[NPC:]` auto-registration and `[NPC_UPDATE:]` relations and polluting the dossier. `npcRelations` is now engine-owned in the merge, and the summarize prompt no longer asks for `npcRelations`/`currentLocation`/`visitedLocations` (all engine-owned and previously discarded or harmful).
- **Summarizer stale-write race fixed.** The fire-and-forget summary update now re-reads the latest session state after the LLM call instead of writing a merge based on a seconds-old snapshot, so a player turn taken during summarization is no longer clobbered. Completed sessions are skipped.

## [0.4.21] — 2026-06-09

### Fixed
- **EN sessions no longer receive a mixed-language Keeper prompt (ANT-116).** All request-time prompt injections are now localized to the session language: the pending-roll / action-nudge / passive-style activity sections, the random-event instruction, the explicit "show me" image instruction, the Gemini split-cache state preamble, and the world-state summarizer prompt (summaries for EN sessions are now written in English instead of Ukrainian). Campaign context labels ("Evening N:") and the campaign close-session summarizer follow the session language too.
- **Passive-player detection now understands English.** Short English actions like "I run" or "open it" are no longer miscounted as passive turns (which previously skewed the balanced Keeper into nudging active players); English confirmations ("ok", "go on") are correctly counted as passive.

## [0.4.20] — 2026-06-09

### Added
- **Living case plan sidebar (ANT-115).** GameChat now supports a Keeper-maintained `world_state.casePlan` with `available`, `completed`, `crossed_out`, and `hidden` plan items. The Keeper can update it through `[CASE_PLAN:{...}]` tags, and the side dossier renders visible plan items as an evolving investigation checklist.

### Changed
- **GameChat vignette removed.** The demo-style full chat keeps the dossier/console visual language but no longer darkens the edges with the heavy radial vignette overlay.
- **Pending dice rolls now lock the composer.** While a roll is active, the normal chat composer, voice input, queue, and inventory actions are replaced by the roll UI so players cannot submit arbitrary text before resolving the roll.
- **Dice roller restyled.** The d100 roller now matches the dossier/console visual language instead of the old rounded stone-card styling.

## [0.4.19] — 2026-06-08

### Changed
- **GameChat demo-style visual refresh (ANT-114).** The full session chat now adopts the stronger `/demo` dossier + live transcript visual language while keeping the expanded game controls: TTS replay/autovoice, ambient, Keeper style, dice modes, voice input, multi-player queue, inventory, completion feedback, read-only sessions, and admin debug/export.
- **Case dossier placement.** On desktop the case dossier rail now reads like the demo file panel, sitting as the left-hand case file beside the dark transcript console; mobile keeps the existing bottom-sheet behavior for playability.

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

---

## [0.3.20] — 2026-06-21

### Added
- **SEO foundation**: додано canonical metadata, `robots.txt`, `sitemap.xml`, JSON-LD для Barri як web game/app, а також generated Open Graph/Twitter preview images.
- **Launch metadata pack**: додано `LAUNCH_METADATA.md` з Product Hunt / itch.io positioning, asset checklist і share copy.
- **SEO tests**: додано guardrail-тести для sitemap/robots/structured data, щоб приватні app/auth/API сторінки не потрапляли в індексацію.
- **Legal baseline pages**: додано `/cookies` і `/legal-notice`, а `/privacy` та `/terms` замінено з draft-заглушок на базові launch-ready legal pages.

### Changed
- **Landing hero**: перший екран тепер чіткіше продає продукт: AI Keeper, browser tabletop horror, d100, voice/text, no-account demo і primary CTA на `/demo`.
- **Landing preview**: абстрактну dossier-картку замінено на live game preview з Keeper message, objective, stats і free-text input.
- **Public copy**: acquisition-тексти зроблено більш trademark-safe: прямі Call of Cthulhu/CoC claims прибрані з hero/cases, а affiliation disclaimer лишився у footer.
- **Mobile landing**: hero/topbar/CTA адаптовано без horizontal overflow; demo CTA видно у першому mobile viewport.
- **Legal footer**: footer тепер веде на Privacy, Cookies, Terms і Legal Notice; fallback consent banner містить посилання на Cookie Policy.
- **Demo atmosphere**: з `/demo` прибрано темну віньєтку по краях, лишено легку архівну текстуру.

### Fixed
- **Scenario source of truth**: runtime scenario JSON can now be pinned with `SCENARIOS_DIR`, and direct `process.cwd()/scenarios` readers were moved onto the shared helper. Production/staging should read one shared scenario directory instead of drifting between repo, image, and mounted data copies.
- **Cookiebot fallback**: якщо Cookiebot блокується або зависає у браузері на кшталт Dia/adblock (навіть із `window.Cookiebot` stub без ready consent), Barri показує first-party analytics consent banner замість порожнього стану без банера.
- **Cookiebot reliability**: consent flow тепер слухає повний набір Cookiebot lifecycle events (`ConsentReady`, `Load`, `Accept`, `Decline`, `DialogInit`, `DialogDisplay`), не показує fallback поверх живого CMP і має Privacy-page кнопку для зміни/відкликання cookie settings.
- **Mobile chat layout**: демо-досьє та основна панель матеріалів справи на mobile/tablet тепер відкриваються як drawer, а чат і поле вводу лишаються основним видимим екраном.
