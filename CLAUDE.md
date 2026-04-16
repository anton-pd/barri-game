# Barri Game — AI Keeper for Call of Cthulhu

Web app for tabletop RPG sessions with an AI Keeper (GM).
Live at **barrigame.es** (Prod) and **staging.barrigame.es** (Staging).
Repo `/opt/apps/cthulhu` (Staging/AI) and `/opt/apps/cthulhu-prod` (Prod).

**Identity**: You are **Claude**. Only take tasks assigned to **Claude** in Linear.
Codex take tasks assigned to **Codex**.

@AGENTS.md
@PROJECT_CONTEXT.md
@LINEAR.md

## After every change — mandatory

After completing **any** code change, always update both files before finishing:

1. **NOTES.md** — append a section describing what was done: problem → solution → key decisions. Never delete existing entries.
2. **CHANGELOG.md** — add an entry under the appropriate version (bump patch if needed). Format: `## [x.y.z] — YYYY-MM-DD` with `### Added / Changed / Fixed` subsections.

These updates must be in their own commit (or included in the final commit of the task). Do not skip even for small fixes.

## Scenario authoring

Full authoring guide: **SCENARIO_GUIDE.md** (read on demand — do not load by default).
Existing scenarios: `scenarios/the-haunting.json`, `scenarios/the-last-telegram.json`.
