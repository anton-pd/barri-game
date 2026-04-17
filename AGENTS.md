# Barri Game — Agent Instructions

Web app for tabletop RPG sessions with an AI Keeper (GM) for Call of Cthulhu and other systems.
Live at **barrigame.es** (Prod) and **staging.barrigame.es** (Staging).
Repo `/opt/apps/barri-dev` (Staging, branch `staging`) and `/opt/apps/barri` (Prod, branch `main`). Containers: `apps-barri-dev-1` (staging :3001), `apps-barri-1` (prod :3000). Scenarios + image cache are shared via `/opt/apps/shared_data/` (Docker volumes mount into both).

Full architecture, DB schema, AI tag protocol, and conventions are in **PROJECT_CONTEXT.md** — read it before making any changes.

## Quick Project Map

- `src/app/` — App Router pages and API routes
- `src/components/` — UI components for chat, sessions, admin, and controls
- `src/lib/` — DB access, prompts, rulesets, cost tracking, AI helpers, and shared logic
- `scenarios/` — persistent scenario JSON files
- `public/scenarios/` — generated and cached scenario assets
- `NOTES.md` / `CHANGELOG.md` — append-only task journal and user-facing release notes

---

## This is NOT the Next.js you know

This project uses **Next.js 16.2** (App Router, standalone output). APIs, conventions, and file structure differ from your training data. Before writing any code:
- Read the relevant guide in `node_modules/next/dist/docs/`
- Heed deprecation notices in compiler output

---

## Linear Workflow (Final for Claude + Codex)

Canonical workflow lives in **LINEAR.md**. This section is only a short checklist.

- **Access policy**: Linear is **API-only** (`LINEAR_API_KEY`), no MCP/OAuth path.
- **API availability**: `LINEAR_API_KEY` is expected to be available both in the local Barri dev environment and on the VPS Codex environment. If it appears empty in the current shell, verify the project's env sources first before concluding that API access is broken.
- **Identity**: Claude takes only Claude tasks, Codex takes only Codex tasks (unless Anton explicitly asks otherwise).
- **Project scope**: all issues must be in **Barri** (`ffeca0b2-16b3-4d2e-a7e6-0181ea2e991c`) / team **Anton_ux** (`c5959f1e-2ee7-4087-a234-20a44b69d8f0`).

1. **Selection**: `Todo` → `In Progress`, assignee → self.
2. **Complexity gate**: if complex, move to `Planned`, assignee → Anton, post plan and wait; if small, add `small-task` + short reasoning comment and continue.
3. **Setup**: create `feature/ANT-XXX` from `staging` (for complex tasks only after `Planned` approval).
4. **Dev**: implement and verify on [staging.barrigame.es](https://staging.barrigame.es), assignee stays self.
5. **Pre-review**: update `NOTES.md` + `CHANGELOG.md`, use commit format `ANT-XXX: summary`, post mandatory Linear review comment.
6. **Review handoff**: `In Progress` → `In Review`, assignee → Anton.
7. **Deploy**: when Anton moves to `Ready for deploy` and assigns back, deploy (`staging` → `main`) and close as `Done`.

If API access looks broken, first verify the Barri env sources that normally provide `LINEAR_API_KEY` (local env / VPS env). Only after that should you ask Anton to restore API access. Do not switch to MCP flow.

When Anton asks for a plan/audit, create separate issues in `AI Improvements` (one issue per fix/feature), assigned to self.

---

## Shared notes

**NOTES.md** — shared scratchpad between models. Update after every task. Append only.

---

## Scenario authoring

Full guide: **SCENARIO_GUIDE.md**.
Existing scenarios: `scenarios/the-haunting.json`, `scenarios/the-last-telegram.json`.
