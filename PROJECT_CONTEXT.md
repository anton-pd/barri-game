# Barri Game — Project Context

> LLM-optimized reference. Updated manually. Changelog lives in NOTES.md.

---

## Purpose

Web app for tabletop RPG sessions of **Call of Cthulhu** (and other systems) with an AI Case Curator (GM).
Players join a session, interact with the Case Curator via chat/voice, roll dice, track stats/inventory.
Live at **https://barrigame.es** (Prod) and **https://staging.barrigame.es** (Staging).
Repo: `/opt/apps/barri-dev` (Staging, branch `staging`, container `apps-barri-dev-1`), `/opt/apps/barri` (Prod, branch `main`, container `apps-barri-1`). Persistent scenario JSONs and generated images live in `/opt/apps/shared_data/{scenarios,public/scenarios}` and are mounted into both containers.

VPS service map and cleanup notes live in **SERVER_STRUCTURE.md**.

---

## Tech Stack

| Layer | Detail |
|-------|--------|
| Framework | Next.js 16.2 (App Router, standalone output), TypeScript, Tailwind 4 |
| Database | PostgreSQL — `postgres` package, no ORM |
| AI — engine | DeepSeek `deepseek-v4-flash` in two tiers (ANT-142): **base** = direct API (free/trial), **pro** = via OpenRouter pinned to Cloudflare (future paid; TTFT ~0.6s) |
| AI — aux | Google Gemini `gemini-2.5-flash` (world-state summarize), `gemini-2.5-flash-image`, `gemini-2.5-flash-preview-tts`, `gemini-2.5-pro` (scenario generation); DeepSeek `deepseek-v4-flash` (campaign close in `campaigns.ts`). Anthropic removed from the app/runtime (ANT-167) — only the dev eval harness (`scripts/eval`) still uses it. |
| TTS | OpenAI `tts-1`, Gemini TTS, ElevenLabs (ambient sound loops) |
| STT | OpenAI `whisper-1` |
| Hosting | Hetzner CX32 VPS, Docker Compose, Caddy reverse proxy + Let's Encrypt |

---

## Architecture

```
External (443) → Caddy → [Prod] apps-barri-1 container (:3000)
                       → [Staging] apps-barri-dev-1 container (:3001)

Code checkouts:
├── /opt/apps/barri      — Prod repo (branch main)
└── /opt/apps/barri-dev  — Staging repo (branch staging)

Shared persistent data (mounted into BOTH containers; scenario JSON path is selected by `SCENARIOS_DIR`):
└── /opt/apps/shared_data/
    ├── scenarios/         — Scenario JSONs (shared prod+staging)
    └── public/scenarios/  — Generated images (shared prod+staging)
```

Other known VPS services:
- `apps-postgres-1` — shared PostgreSQL container with separate DBs (`barri_prod`, `barri_dev`).
- `hermes gateway run` — Hermes agent/gateway; not part of Barri deploys.
- Directus — separate service; not part of the Barri app deploy path.
- Removed/deprecated: `tg-bot.service` and `/opt/tg-bot` (old Telegram polling bot that spammed syslog after token revocation).

**AI turn flow:**
1. Client POST `/api/ai` with `{sessionId, message, playerIdx, keeperStyle}`
2. Server loads session from DB → builds prompt blocks → calls LLM (streaming SSE)
3. LLM response contains inline tags (`[DELTA:]`, `[ITEM:]`, `[NPC:]`, etc.)
4. Server parses tags → applies mutations → saves to DB → streams `done` event with updated state

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── ai/route.ts            — main AI endpoint, tag parsing, cost tracking
│   │   ├── tts/route.ts           — TTS (OpenAI + Gemini)
│   │   ├── stt/route.ts           — STT (Whisper)
│   │   ├── image/route.ts         — image gen + disk cache
│   │   ├── sessions/              — CRUD for game_sessions
│   │   └── scenarios/             — scenario listing + images
│   ├── session/[id]/page.tsx      — game page
│   └── page.tsx                   — session list
├── components/
│   ├── GameChat.tsx     — game UI: chat, TTS playback, ambient, inventory drawer, NPC bubbles
│   ├── DiceRoller.tsx   — virtual d100 roller (two d10, slot animation, result→LLM)
│   ├── SessionList.tsx  — session list + new session modal (scenario → roles → settings)
│   ├── StatsBar.tsx     — HP/SAN/LCK display + inventory (equipped/broken states)
│   └── VoiceButton.tsx  — STT input trigger
└── lib/
    ├── db.ts            — postgres connection pool
    ├── queries.ts       — all SQL queries + initializeSchema()
    ├── prompts.ts       — buildSystemPromptBlocks({ruleset,static,dynamic}), buildSummarizePrompt
    ├── rulesets.ts      — RULESETS configs, buildRulesetPromptBlock()
    ├── roles.ts         — role presets, getRolesForScenario(), makePlayer()
    ├── campaigns.ts     — campaign creation, context, session close
    ├── assets.ts        — getOrGenerateImage() — scenario→campaign→generate with disk cache
    ├── costTracker.ts   — trackAPICall(), PRICING table, admin aggregates
    ├── randomEvents.ts  — probability engine (see Random Events section)
    ├── segments.ts      — parseSegments(), stripNpcTags(), hasNpcSpeech()
    ├── ttsEngine.ts     — TTS orchestration (voice selection, caching)
    └── ttsPrefetch.ts   — prefetch next segment TTS in background
```

---

## Database Schema

| Table | Key columns | Purpose |
|-------|-------------|---------|
| `game_sessions` | id, scenario_id, world_state JSONB, players JSONB, campaign_id, keeper_style, language | One session = one game |
| `messages` | id, session_id, role, content, player_idx | Full chat history |
| `users` | id (UUID), email, role, email_verified | Auth |
| `campaigns` | id, user_id, scenario_id, world_state, npc_states, session_count | Multi-session campaigns |
| `session_summaries` | campaign_id, session_id, session_number, summary, key_events | Haiku-generated summaries every 20 msgs |
| `scenario_assets` | scenario_id, type, tags[], url, prompt | Scenario-level images |
| `campaign_assets` | campaign_id, type, tags[], url | Campaign-specific images |
| `api_usage` | provider, type, model, input_tokens, output_tokens, cost_usd | Cost tracking per call |
| `model_pricing` | provider, model, metric, value_usd, updated_at | Editable API prices (UNIQUE provider+model+metric) |

---

## AI System

### Engine tiers + Prompt Caching

`AiProvider = 'deepseek-base' | 'deepseek-pro'` (ANT-142). The admin Case Curator Settings switch (`app_settings.ai_provider`) selects the tier globally; legacy stored values (`claude-sonnet` / `gemini-flash` / `deepseek-flash`) resolve to base. Pro goes through OpenRouter with `provider: { order: ['Cloudflare'], allow_fallbacks: true }`. Per-user tier binding is deferred until billing exists.

`buildSystemPromptBlocks()` returns `{ ruleset, static, dynamic }`:

| Block | Size | Cached | Content |
|-------|------|--------|---------|
| `ruleset` | ~400-500 tok | Yes | Dice rules for CoC/KoB from `rulesets.ts` |
| `static` | ~600-900 tok | Yes | System prompt + filtered NPCs (met only) + filtered locations + railguards |
| `dynamic` | ~400-600 tok | No | Current world_state + players with full inventory (item IDs included) |

Prompt shape is split-tail (ANT-126): system = ruleset+static (stable, implicit-cached by both DeepSeek direct and Cloudflare), dynamic state as a `[СТАН СЕСІЇ]` tail turn before the player message. Cost tracking folds cached tokens into equivalent miss tokens via `cacheReadFactor` (base ×0.1, pro ×0.4).
Limits: `max_tokens: 1200` (main turns, raised from 900 in ANT-129), `1400` (intro), `500` (summarize).

### Model Pricing

Prices stored in `model_pricing` DB table (seeded on first `initializeSchema()` run). `costTracker.ts` loads from DB with 7-day in-memory cache. Admin can update via `PATCH /api/admin/pricing` `{provider, model, metric, value_usd}`. Cache invalidated on write.

Metrics: `inputPer1M`, `outputPer1M` (LLM tokens), `perChar` (TTS), `perImage` (image gen), `perMinute` (STT).

### Tag Protocol

LLM embeds structured tags in its response text. Server parses and applies them:

```
[DELTA:{"idx":{"hp":±N,"sanity":±N,"luck":±N}}]   — stat changes
[ITEM:idx:Name:Desc:uses]                           — add item to inventory
[USE_ITEM:idx:itemId]                               — consume 1 use
[REMOVE_ITEM:idx:itemId]                            — delete item
[EQUIP:idx:itemId]                                  — set as equipped
[BREAK_ITEM:idx:itemId]                             — mark as broken
[IMAGE:type:english description]                    — trigger image generation
[LOCATION:location_id]                              — move to existing location (scenario or dynamic)
[NEW_LOCATION:id:Name:Description]                  — create situational location + move there
[NPC:Name]speech text[/NPC]                         — NPC dialogue bubble
[SET_PENDING_ROLL:idx:skill:val:threshold:context]  — request dice roll (percentile rulesets only, ANT-120)
[CLEAR_PENDING_ROLL]                                — cancel pending roll
[RANDOM_EVENT:type:event_id]                        — resolve active random event
[NPC_UPDATE:Name:relation:notes]                    — update NPC relation + cumulative notes
[CASE_PLAN:{"id","label","status","note"}]          — upsert living case plan item
[COMPLETE_SESSION]                                  — scenario finale (client opens confirmation modal)
[FINISH_EVENING]                                    — campaign evening finale (client opens confirmation modal)
```

All `[DELTA:]` tags apply in order; `[LOCATION:]`/`[NEW_LOCATION:]` moves apply in document order, the last move becomes current (ANT-118). `[SET_PENDING_ROLL]` values are validated against the character sheet server-side (ANT-119).

### Message Persistence

- Saved to DB: `textForDB` — **NPC and IMAGE tags preserved**; data-only tags stripped (DELTA, LOCATION, NEW_LOCATION, NPC_UPDATE, CASE_PLAN, COMPLETE_SESSION, FINISH_EVENING; inventory/roll/event tags are stripped during parsing)
- On client reload: `parseSegments()` restores NPC bubbles and dynamic images from DB content
- `cleanText` (all tags stripped) used for the `done` SSE event and TTS input. Live stream chunks are raw model output — the client display path hides data tags and trailing partial tags while streaming (ANT-121)

### Dynamic Image Caching

`[IMAGE:type:desc]` triggers client-side image generation. Flow:

1. **First render** — `DynamicImage` component checks `world_state.sessionImages[msg.id]`:
   - No URL → fetches `/api/image?prompt=...&json=true` → server generates, saves to `/app/public/scenarios/dynamic/HASH.jpg`
   - **Persistence**: Mapped via Docker volumes to `/opt/apps/shared_data/public/scenarios` (shared between Prod and Staging).
   - Client calls `onUrlGenerated(msg.id, url)` → updates `sessionImages` in React state + PATCHes `world_state` to DB
2. **Subsequent renders / page reload** — `sessionImages[msg.id]` has the URL → renders `<img src={url}>` directly, no API call
3. **Key invariant** — `sessionImages` must be keyed by the real DB `message.id`, not the temporary optimistic ID used during streaming. The `/api/ai` `done` event returns `messageId` so the client remaps optimistic IDs before any image is rendered.

### NPC Auto-Registration

On each AI response: server scans for `[NPC:Name]` → if name matches `scenario.npcs` and not yet in `npcRelations` → auto-adds as `'unknown'`. No wait for summarize cycle.

`npcRelations` is **engine-owned**: the periodic world-state summary merges narrative fields only and cannot overwrite it (ANT-117). Relations change via auto-registration and `[NPC_UPDATE:]` tags.

---

## WorldState Shape (relevant fields)

```typescript
{
  currentLocation: string
  currentLocationGroup: string
  passiveMessageCount: number
  totalMessageCount: number
  pendingRollResult: { characterIdx, skillName, skillValue, goodThreshold, context } | null
  locationRisk: Record<groupId, { currentChance, incrementRate, eventCycleCount, lastEventAt }>
  activeRandomEvent: { type, event_id } | null
  npcRelations: Record<npcId, 'friendly'|'neutral'|'hostile'|'unknown'>  // engine-owned (ANT-117)
  npcDetails: Record<npcId, { notes: string }>  // cumulative [NPC_UPDATE:] notes
  dynamicNpcs: { id: string; name: string }[]   // improvised NPCs not in scenario JSON
  casePlan: { items: { id, label, status: 'hidden'|'available'|'completed'|'crossed_out', note? }[] }  // living case plan ([CASE_PLAN:] tags)
  sessionImages: Record<msgId, '/scenarios/dynamic/HASH.jpg'>  // persisted image URL cache
  dynamicLocations: Record<locId, { name: string; description: string }>  // situational locations
}
```

---

## Random Event Engine (`randomEvents.ts`)

Server decides, LLM only executes:
- Base probability: 5%, max: 60%
- Increment halves each cycle: cycle 1 → max in ~10 msgs, cycle 2 → ~20 msgs, cycle 3 → ~40 msgs
- Transition events: 15% chance on location group change
- Event types (weighted): roll_event 35%, negative 30%, neutral 20%, positive 15%
- `eventHints` in scenario JSON provide LLM with thematic suggestions

---

## Location Types

| Type | Defined in | Audio | Prompt details |
|------|-----------|-------|---------------|
| **Static** | `scenario.json → locations[]` | Yes (via `locationGroups`) | Full description + clues for current/visited |
| **Situational** | `world_state.dynamicLocations` | No | Only `id (name)` in dynamic block |

LLM uses `[LOCATION:id]` for both. Creates situational ones with `[NEW_LOCATION:id:Name:Desc]` — server saves to `dynamicLocations`, adds to `visitedLocations`. On page load, `locationNames` map includes both sources so UI shows correct name.

---

## Scenarios

Files in `/opt/apps/shared_data/scenarios/` (shared by both prod and staging):
- `the-haunting.json` — CoC 7e, beginner, locationGroups: elm_street_house + public_library
- `the-last-telegram.json` — CoC 7e, intermediate, isCampaign: true, 4 location groups

Key fields: `rulesetId`, `supportedRoles`, `sessionConfig`, `locationGroups`, `eventHints`, `ambientFile` per location.

Source of truth: live scenario JSON is `/opt/apps/shared_data/scenarios`, mounted into both containers and exposed to the app via `SCENARIOS_DIR`. The repo `scenarios/` folder is the local-development fallback/template set, not the live runtime source.

**Authoring guide:** `SCENARIO_GUIDE.md`

---

## Key Conventions

1. **Inventory is source of truth** — LLM generates tags, server applies mutations, DB stores result. Never trust LLM to maintain inventory state across turns.
2. **Backward compatibility** — all new fields on existing types are optional; legacy `hp`/`sanity`/`luck` on Player still work.
3. **No ORM** — raw SQL via `postgres` package. All queries in `lib/queries.ts`.
4. **Non-blocking side effects** — `trackAPICall()` and NPC registration are fire-and-forget; don't await them in the critical path.
5. **Next.js standalone caches `public/`** — after adding new files to the public volume, `docker compose -f /opt/apps/docker-compose.yml restart barri` (prod) / `barri-dev` (staging) is required.
6. **Case Curator style** — stored as legacy `keeperStyle` in localStorage, default `'balanced'`. Values: `'passive'`, `'balanced'`, `'active'`.
7. **DiceRoller** — shown when `world_state.pendingRollResult` is set + `diceMode === 'virtual'` (localStorage). Result determined by `Math.random()` before animation. On confirm: optimistically clears `pendingRollResult` locally, then sends result as plain message to LLM. Key prop forces remount on each new roll. Physical mode shows inline hint only.
8. **Language** — stored in `game_sessions.language` (`'uk'` default, `'en'` supported). Set from the user's interface language at session creation. `buildSystemPromptBlocks()` injects language instruction + response style. Canonical Keeper-only scenario content remains Ukrainian and the AI translates it; player-facing catalog, briefing, roles, inventory, and location names use `localizations.en` (with bundled overlays for legacy live scenarios).
9. **Ambient launch flag** — ambient is disabled by default for beta. Playback, the player controls, session-start generation, the ambient API, and admin materialization only activate when server runtime env `AMBIENT_ENABLED=true`. Existing generated files remain on disk for a later rework.

---

## Current Gaps (not implemented)

| Item | Notes |
|------|-------|
| `generateImageExternal()` in `assets.ts` | Placeholder — throws; not yet needed |
| SSE client-side error recovery | Basic retry only |
| DiceRoller visuals | Currently slot-machine animation. 3D physics (dice-box/Babylon.js) tried but incompatible with Next.js standalone. Revisit with raw Three.js or Babylon.js canvas. |

---

## Deploy Workflow

1. **Staging Dev**: Work on `feature/ANT-XXX` from `staging`. Review at `staging.barrigame.es`.
2. **Staging deploy**: Merge/push approved changes to `staging`; GitHub Actions deploys `/opt/apps/barri-dev` and rebuilds `barri-dev`.
3. **Approval**: User moves Linear task to **Ready for deploy**.
4. **Production deploy**: Promote `staging` to `main`; GitHub Actions deploys `/opt/apps/barri` and rebuilds `barri`.
5. **Fallback**: If Actions fails for infrastructure reasons, use the manual deploy commands in `SERVER_STRUCTURE.md`.
