# Barri Game — Agent Instructions

Web app for tabletop RPG sessions with an AI Keeper (GM) for Call of Cthulhu and other systems.
Live at **barrigame.es** (Prod) and **staging.barrigame.es** (Staging).
Repo `/opt/apps/cthulhu` (Staging/AI) and `/opt/apps/cthulhu-prod` (Prod).

Full architecture, DB schema, AI tag protocol, and conventions are in **PROJECT_CONTEXT.md** — read it before making any changes.

---

## This is NOT the Next.js you know

This project uses **Next.js 16.2** (App Router, standalone output). APIs, conventions, and file structure differ from your training data. Before writing any code:
- Read the relevant guide in `node_modules/next/dist/docs/`
- Heed deprecation notices in compiler output

---

## Linear Workflow (Parallel-Safe)

Full workflow details in **LINEAR.md**. Summary:

1. **Selection**: Take task from **Todo** (assigned to you), move to **In Progress**, assignee → **Self**.
2. **Setup**: Create `feature/ANT-XXX` from `staging` branch.
3. **Plan**: Post technical plan (if complex). Move to **Planned**, assignee → **Anton**.
4. **Dev**: Implement and test on [staging.barrigame.es](https://staging.barrigame.es). Assignee → **Self**.
5. **Review**: Merge to `staging`, move issue to **In Review**, assignee → **Anton**.
6. **Deploy**: When user moves to **Ready for Deployment** and assigns back to **Self**: merge to `main`, push to GitHub, update prod folder.
7. **Finalize**: Move task to **Done**, keep on **Self**.

**AI Improvements**: When asked for plans/audits, create issues in **AI Improvements** column (1 per fix/feature) and assign to self.
**Small tasks**: Add `small-task` label, skip step 3. Document reasoning.
**Identity**: Claude takes "Claude" tasks, Codex takes "Codex" tasks.

Assignee is always **Anton** for reviews. AI moves to Review — Anton moves to Ready for Deployment.

---

## Shared notes

**NOTES.md** — shared scratchpad between models. Update after every task. Append only.

---

## Scenario authoring

Full guide: **SCENARIO_GUIDE.md**.
Existing scenarios: `scenarios/the-haunting.json`, `scenarios/the-last-telegram.json`.
