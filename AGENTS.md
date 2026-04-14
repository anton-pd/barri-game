# Barri Game — Agent Instructions

Web app for tabletop RPG sessions with an AI Keeper (GM) for Call of Cthulhu and other systems.
Live at **barrigame.es** · repo `/opt/apps/cthulhu` · branch `main`.

Full architecture, DB schema, AI tag protocol, and conventions are in **PROJECT_CONTEXT.md** — read it before making any changes.

---

## This is NOT the Next.js you know

This project uses **Next.js 16.2** (App Router, standalone output). APIs, conventions, and file structure differ from your training data. Before writing any code:
- Read the relevant guide in `node_modules/next/dist/docs/`
- Heed deprecation notices in compiler output

---

## Linear Workflow

Full workflow details in **LINEAR.md**. Summary:

1. Set issue → **In Progress**, assignee → Anton
2. Post **plan comment** (files, approach, why) — before any code
3. Implement
4. Commit + push
5. Update **CHANGELOG.md** and **NOTES.md**
6. Post **summary comment** (problem → solution → result → commit hash)
7. Set issue → **Done**

Assignee is always **Anton**. Claude sets Done — Anton reviews.

---

## Shared notes

**NOTES.md** — shared scratchpad between models. Update after every task. Append only.

---

## Scenario authoring

Full guide: **SCENARIO_GUIDE.md**.
Existing scenarios: `scenarios/the-haunting.json`, `scenarios/the-last-telegram.json`.
