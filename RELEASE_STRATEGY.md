# Barri — Release Strategy: 0 → 100 Recurring Users

> Prepared 2026-07-03 (ANT-189). Owner: Anton. Grounded in prod data as of today.

---

## 1. Where we actually are (facts, not vibes)

| Fact | Value | Source |
|------|-------|--------|
| Prod users | 3 (1 admin) | `users` table |
| Active sessions, last 30d | 1 | `messages` |
| Waitlist | 1 entry | `waitlist_entries` |
| Cost per played session | **~$0.07** (images dominate; LLM ≈ $0.001/turn) | `api_usage` 30d |
| Content | 9 scenarios (3 campaigns), uk-native; en auto-translated | shared_data |
| Launch assets | PH + itch pack ready (`LAUNCH_METADATA.md`) | ANT-111 |
| Access | Demo is account-free; full game is **invite-gated waitlist** | ANT-180 |
| Billing | None. Free tier only (deepseek-base), per-user daily cost cap exists | ANT-108/142 |

**Implication of $0.07/session:** 100 recurring users playing ~8 sessions/month ≈ **$56/month** in API costs. Unit economics are a non-issue at this scale — growth, not cost, is the constraint. We can be generous with the free tier for the entire 0→100 phase.

**Implication of 1 waitlist entry:** there is no pent-up demand to "release to". The launch is an audience-building campaign, not a floodgate opening.

---

## 2. Goal definition

**Recurring user** := a user with **≥3 played sessions across ≥2 distinct calendar weeks** in the trailing 30 days. (A "played session" = session with ≥10 player messages.)

Target: **100 recurring users within ~8 weeks of global launch.**

### Funnel math (what it takes)

Working backwards with conservative niche-product rates:

```
100 recurring
 ← ~330 activated users        (30% activated → recurring)
 ← ~660 signups                (50% signup → activated)
 ← ~8,000–12,000 targeted visitors  (6–8% visitor → signup, via demo)
```

- **Activated** := finished the intro + sent ≥20 messages in a first real session.
- The demo is our conversion weapon: account-free play means the visitor→signup step is really *demo→signup*, which converts far better than a marketing page.
- 10k targeted visitors over 6–8 weeks is realistic from the channel plan below. 10k generic visitors would not be.

---

## 3. Positioning & wedge

**Do not sell "AI Dungeon Master for everyone".** That market is noisy (AI Dungeon, Friends & Fables, etc.) and dominated by D&D power fantasy. Our wedge:

1. **Primary: the GM-less problem.** Solo players and groups where nobody wants to (always) run the game. The person who always GMs finally gets to play. This is the exact pain in r/solo_roleplaying and every "how do I find a GM" thread.
2. **Genre: slow-burn investigative horror**, not combat power fantasy. Clue trails, sanity, consequences, campaign memory. Nobody else does d100 roll-under investigation well.
3. **Ukrainian-first as identity, not limitation.** The only AI game master with native Ukrainian content and folklore-grounded scenarios (molfars, kurgans, Dnipro). In UA this is a story worth telling; globally it's flavor and press-worthiness ("built in Ukraine, haunted by Ukraine").

Tagline direction (already in PH pack, keep): *"AI Case Curator for browser tabletop horror — narrates scenes, tracks clues, rolls d100, remembers your campaign."*

---

## 4. 🚨 Launch blocker: the Chaosium problem

"Call of Cthulhu" is a **Chaosium trademark**, and 7e is their commercial ruleset. A free fan project flies under the radar; a globally-launched product on Product Hunt with "Call of Cthulhu 7e" in the UI is cease-and-desist bait, and future paid tiers make it worse.

**Recommendation (do before PH launch):**
- Public-facing copy: replace "Call of Cthulhu 7e" with **"classic 1920s investigative horror (d100 roll-under)"**. Mechanics are not copyrightable; the trademark and rule-text are what matter. Keep internal `rulesetId: coc_7e` — it's not user-visible.
- Audit: landing, scenario cards, briefings, PH/itch metadata, ruleset prompt header (player-visible dice hint texts).
- Longer-term option: write to Chaosium about a license — they do license digital products; but don't block launch on their reply.

---

## 5. Phased plan

### Phase 0 — Launch-ready week (pre-announcement)

Product changes (each is a Linear issue, listed in §8):

1. **Kill the invite gate.** Self-serve signup with instant access. The waitlist made sense before the cost caps existed; now it's pure friction between a converted demo player and their first real session. Keep the daily cost cap as the abuse valve; keep the waitlist code behind a flag for emergencies.
2. **Trademark scrub** (§4).
3. **Native EN versions of 2 flagship scenarios** (`the-haunting` is basically genre-standard; translate `whisper-in-the-well` + `shadows-over-dnipro`). Auto-translation of uk content is our known quality gap — first global impressions can't depend on it.
4. **Activation funnel events** in PostHog: `demo_started`, `demo_20_messages`, `signup`, `first_session_started`, `first_roll`, `session_completed`, `return_session`. Without these we're flying blind on the only numbers that matter.
5. **Campaign reminder email** ("your investigation is waiting — evening 2 of «Тіні над Дніпром»") 48h after an unfinished campaign evening. Email infra already exists (ANT-180 invites).

### Phase 1 — Ukrainian launch (week 1–2): win the home market first

Why UA first: native content advantage is overwhelming, communities are tight and reachable, feedback loop is fast, and 30–50 recurring users can plausibly come from UA alone. It also generates the screenshots/testimonials the global launch needs.

Channels, in priority order:
1. **DOU.ua / dev.ua founder story** — "Як я збудував AI-ведучого для НРІ" (how-I-built-it angle, tech + game). DOU longreads reliably do 10–30k views; even 2% click-through is 200–600 highly targeted visitors. This is the single highest-leverage UA action.
2. **UA tabletop Telegram/Discord communities** (НРІ спільноти, D&D UA servers, «Куток НРІ»-style channels). Not drive-by ads: offer a **community game night** — a shared campaign evening with the community, feedback channel open.
3. **UA actual-play creators (5–10 micro, YouTube/TikTok/Twitch)**: free unlimited access + a scenario named/themed with them. Actual-play of «Кургани не сплять» IS the ad.
4. **Itch.io listing** (assets ready) — tag: horror, rpg, ukrainian. Itch loves free browser weirdness and gives a permanent long-tail front door.

### Phase 2 — Global EN launch (week 3–4)

1. **Product Hunt** (assets ready). Realistic outcome for this niche: 300–800 visits day-one, long-tail from lists. Launch Tuesday–Thursday, maker comment already drafted in LAUNCH_METADATA.md.
2. **Show HN** — the honest technical story ("I built an AI game master that actually enforces dice rules — here's the tag protocol") outperforms product pitches on HN. Link the demo directly.
3. **Reddit, surgically** (read each sub's self-promo rules; post as a person, not a brand):
   - r/solo_roleplaying — *the* wedge audience; a "played 3 evenings solo, here's how it handled my stupid plans" writeup.
   - r/rpg weekly free-talk / self-promo threads.
   - r/cosmichorror, r/Lovecraft — flavor angle, demo link.
4. **Solo-RPG newsletters/Discords** (Solo RPG Voyages-type communities) — small, but conversion is exceptional.

### Phase 3 — Retention engine + steady drumbeat (week 4–8)

Getting *recurring* users is a product problem more than a marketing problem:

1. **Campaigns are the retention product.** One-shots acquire; campaigns bring people back. Steer finished one-shot players into a campaign ("Ваша справа закрита. Але у Києві щось ворушиться під водою…" → start evening 1).
2. **Weekly scenario drop, every Friday, 6 weeks straight.** The authoring pipeline (guide + generator + this week's 5-scenario sprint) makes this cheap. Announce each drop in every channel from Phases 1–2 — the drumbeat is what converts "tried once" into "checks back".
3. **Shareable session recap card** — auto-generated image (scenario art + party names + verdict + a key moment) at session end. The only organic social loop this product can have. "Ми втрьох втопили бога у Дніпрі" is inherently shareable.
4. **Party invites = referrals.** Multiplayer sessions mean each recurring group leader recruits 1–3 friends who become users for free. Make "invite your party" a first-class button, measure it.
5. **Reminder emails** (Phase 0 item) for unfinished campaigns.

---

## 6. Measurement cadence

- **Weekly cohort review** (Monday): signups, activation %, week-2 return %, recurring count per the §2 definition. PostHog dashboard + one SQL query against `game_sessions`/`messages`.
- **Channel tagging:** every link shipped anywhere carries `?ref=` (dou, ph, hn, reddit-solo, itch, tg-ua, creator-X). Judge channels by *activated users*, not visits.
- **Kill/double rule:** after 2 weeks, double down on the top 2 channels by activation, stop the rest. At this scale focus beats coverage.
- **North-star during phase:** weekly returning players (users with a session this week AND a prior week).

---

## 7. Budget & economics

| Item | Est. monthly |
|------|--------------|
| API costs @ 100 recurring × 8 sessions | ~$60 |
| API costs incl. funnel waste (demos, drop-offs) ×3 | ~$180 |
| Creator seeding (free pro access) | $0 cash |
| Optional: small UA community giveaways/boosts | $100–200 |

No paid ads in this phase — the audience is niche and reachable organically; paid channels would burn cash learning what communities tell us for free. Revisit paid + pro-tier pricing only after 100 recurring proves retention (that's when `deepseek-pro` per-user binding becomes worth building).

---

## 8. Engineering enablers → Linear (AI Improvements)

| # | Issue | Size | Blocks |
|---|-------|------|--------|
| 1 | Trademark scrub: remove "Call of Cthulhu" from user-visible copy | S | PH launch |
| 2 | Self-serve signup (bypass waitlist behind flag, keep cost caps) | M | all funnels |
| 3 | PostHog activation-funnel events + ref-tag capture | M | measurement |
| 4 | Native EN translations: whisper-in-the-well + shadows-over-dnipro | M | EN launch |
| 5 | Campaign reminder email (48h after unfinished evening) | M | retention |
| 6 | Shareable session recap card | L | social loop |
| 7 | Post-one-shot campaign hook ("next case" suggestion at session end) | S | retention |

Marketing/community actions (DOU article, PH submission, Reddit posts, creator outreach) stay with Anton — drafts can be prepared on request.

---

## 9. Risks

1. **Chaosium C&D** — §4, mitigated by scrub. Highest severity, cheapest fix.
2. **Retention is unproven.** Nobody has played 3+ sessions yet. Phase 1 UA cohort is the retention experiment — if week-2 return is <15%, pause acquisition and fix the loop (probably: campaign pacing, reminder emails, session length).
3. **EN quality via auto-translation** — mitigated by issue #4; expand translations if EN cohort activation lags UA by >20 points.
4. **Solo-founder bandwidth** — the plan front-loads product work into Phase 0 and makes Phases 1–3 mostly posting/outreach on a weekly rhythm. The weekly scenario drop is the only recurring production commitment, and it's pipeline-assisted.
5. **A viral spike** breaking the free tier — daily per-user cost cap already exists; add a global daily budget alarm to the admin panel if PH day looks hot.
