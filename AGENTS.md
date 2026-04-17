# Barri Game — Agent Instructions

Web app for tabletop RPG sessions with an AI Keeper (GM) for Call of Cthulhu and other systems.
Live at **barrigame.es** (Prod) and **staging.barrigame.es** (Staging).
Repo `/opt/apps/cthulhu` (Staging/AI) and `/opt/apps/cthulhu-prod` (Prod).

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

## Linear Workflow (Parallel-Safe)

Full workflow details in **LINEAR.md**. Summary:

Use the Linear MCP/plugin path first when it is available. Fall back to the API only when auth is blocked or you only need a read-only query.

1. **Selection**: Take task from **Todo** (assigned to you), move to **In Progress**, assignee → **Self**.
2. **Setup**: Create `feature/ANT-XXX` from `staging` branch.
3. **Plan**: Post technical plan (if complex). Move to **Planned**, assignee → **Anton**.
4. **Dev**: Implement and test on [staging.barrigame.es](https://staging.barrigame.es). Assignee → **Self**.
5. **Review**: Merge to `staging`, move issue to **In Review**, assignee → **Anton**.
6. **Deploy**: When user moves to **Ready for deploy** and assigns back to **Self**: merge to `main`, push to GitHub, update prod folder.
7. **Finalize**: Move task to **Done**, keep on **Self**.

**AI Improvements**: When asked for plans/audits, create issues in **AI Improvements** column (1 per fix/feature) and assign to self.
**Small tasks**: Add `small-task` label, skip step 3. Document reasoning.
**Identity**: Claude takes "Claude" tasks, Codex takes "Codex" tasks.
**Project**: All tasks MUST be created in the **Barri** project (`ffeca0b2-16b3-4d2e-a7e6-0181ea2e991c`) using team **Anton_ux** (`c5959f1e-2ee7-4087-a234-20a44b69d8f0`).

Assignee is always **Anton** for reviews. AI moves to Review — Anton moves to Ready for deploy.

### Codex-Specific Rules

- Take only issues assigned to **Codex** unless Anton explicitly tells you to help on something else.
- If Linear tools are unavailable, stop and reconnect the Linear app rather than guessing or using an unsafe workaround.
- Prefer the Linear MCP/plugin path for reads, writes, comments, and state transitions; keep API fallback for read-only checks.
- For complex work, move the issue to `Planned` and assign Anton before implementation starts.
- For obvious fixes or tiny docs-only work, use `small-task` and skip the plan gate.
- Before moving to `In Review`, ensure the task has the mandatory Linear comment and that `NOTES.md` / `CHANGELOG.md` were updated.
- If Anton asks for a plan or audit, create separate issues in `AI Improvements` instead of burying the work inside the current task.

---

## Shared notes

**NOTES.md** — shared scratchpad between models. Update after every task. Append only.

---

## Scenario authoring

Full guide: **SCENARIO_GUIDE.md**.
Existing scenarios: `scenarios/the-haunting.json`, `scenarios/the-last-telegram.json`.
