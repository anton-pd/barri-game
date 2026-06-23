# Linear Workflow — barrigame.es (Barri project)

## Scope

- This file is the **single source of truth** for Linear workflow for both agents: **Claude** and **Codex**.
- If `AGENTS.md` / `CLAUDE.md` conflict with this file, follow this file and sync docs in the same task.
- **Linear access policy: API only.** Do not use MCP/OAuth flow for this project.

## Project info

- **Project:** Barri — ID `ffeca0b2-16b3-4d2e-a7e6-0181ea2e991c`
- **Team:** Anton_ux (key `ANT`) — ID `c5959f1e-2ee7-4087-a234-20a44b69d8f0`
- **Linear API:** `https://api.linear.app/graphql`
- **Canonical key names:** `CLAUDE_LINEAR_API_KEY` (Claude), `CODEX_LINEAR_API_KEY` (Codex).
- **Env source (single place per machine):**
  - Local: `./.env.linear.local` (contains both keys).
  - VPS: `/opt/apps/.env` (contains both keys).
- **Operational assumption:** never run Codex actions with Claude key (or vice versa). If the current shell does not expose the right key for the current agent, verify the expected env source before treating Linear access as unavailable.

## Identities (team members)

| Person | Display name | Linear ID |
|--------|--------------|-----------|
| Anton Leshchenko | `toxaker` | `2399a9db-92ac-4eb1-ab38-942cfa9a53f3` |
| Claude | `claude` | `4e483311-d106-4708-82a4-421812e84721` |
| Codex | `codex` | `3f8713c1-72d2-4781-b3c0-1ed4e1017a4b` |

**Identity rule:** Claude takes tasks assigned to **Claude**. Codex takes tasks assigned to **Codex**. Never pick up the other agent's tasks unless Anton explicitly requests it.

## Workflow states (actual Linear names — use exactly)

| # | State | Type | ID |
|---|-------|------|-----|
| 1 | `Ideas` | backlog | `9a5d456e-f15a-4be0-82f4-b837c0f462a1` |
| 2 | `Todo` | unstarted | `717e0207-b107-478e-b660-ea0dd0b1ac78` |
| 3 | `Planned` | started | `c475cb47-841b-40e2-8fcd-2b30a8664467` |
| 4 | `In Progress` | started | `f4380255-1dd2-4ced-8cbe-ec475d6b9e52` |
| 5 | `In Review` | started | `c5dc90f8-3f6e-4632-aaca-d8709f1c037d` |
| 6 | `Ready for deploy` | completed | `51376f2c-3c7a-43a8-9987-050f3d9695d1` |
| 7 | `Done` | completed | `fe352261-6d45-415b-97eb-847aeed3356c` |
| 8 | `Improvements` | unstarted | `7b9dfc1c-1638-40ab-8921-5c7bc9687108` |
| 9 | `AI Improvements` | backlog | `c1749d1a-916d-456b-8338-ecd14f360754` |
| 10 | `Canceled` | canceled | `1f0f2642-fd8a-4fcd-a682-4461fcb986b4` |
| 11 | `Duplicate` | canceled | `f417f8e3-5159-47c0-9a87-1ab9caf59f59` |

## Labels

| Label | ID | Use |
|-------|----|-----|
| `planned` | `df5d1957-5972-401a-9391-ed8058181d49` | Task planned, not started |
| `in-execution` | `8cec9395-1235-48db-ab2d-f43be7a80882` | Actively being worked on |
| `review` | `2092c19e-a36e-49bb-8249-06643034d121` | Done, waiting for Anton review |
| `Bug` | `d3f0b884-3595-492e-adec-db89ac9a59cc` | Bug report |
| `Improvement` | `c1f6231c-8492-44e1-b41f-fdc8ed781bee` | Enhancement to existing feature |
| `Feature` | `37601284-f1ae-441a-a292-ddf25fc3d097` | New feature |

## Lifecycle (final)

### 1. Selection
- Take tasks only from `Todo` and only if assigned to your identity.
- Move issue: `Todo` → `In Progress`.
- Set assignee to self (Claude/Codex).

### 2. Complexity gate
- **Complex task:**
  - Move issue to `Planned`.
  - Assign to **Anton**.
  - Post technical plan comment.
  - Wait until Anton moves it back to `In Progress` and assigns back.
- **Small task:**
  - Add `small-task` label (optional, only if the label exists in workspace).
  - Post one comment explaining why plan gate is skipped.
  - Stay in `In Progress`.

### 3. Branch setup
- Create `feature/ANT-XXX` from `staging`.
- For complex tasks: do this only after `Planned` approval (`Planned` → `In Progress`).
- For small tasks: do this right after step 2.

### 4. Development
- Implement and verify on [staging.barrigame.es](https://staging.barrigame.es).
- Keep assignee as self while actively working.

### 5. Pre-review checklist (mandatory)
Before moving to `In Review`, all of the following must be true:
- commit message format: `ANT-XXX: summary`
- `NOTES.md` updated (append-only)
- `CHANGELOG.md` updated
- staging verification done
- Linear review comment posted

### 6. Review handoff
- Move issue: `In Progress` → `In Review`.
- Assign to **Anton**.
- Review comment must include:
  - what was done
  - key decisions
  - test/verification notes
  - staging URL

### 7. Deploy and close
- Anton moves issue to `Ready for deploy` and assigns back to AI.
- AI merges/promotes the approved branch through `staging` and `main`; GitHub Actions auto-deploys pushes to each branch.
- AI verifies the GitHub Actions deploy run and live environment after each promotion. Use the documented VPS manual deploy fallback only if Actions fails for an infrastructure reason.
- Move issue: `Ready for deploy` → `Done`.
- Keep assignee as self on `Done`.

## Two-agent guardrails (required)

- Maximum one `In Progress` issue per agent at a time.
- Do not keep active (`Todo`/`In Progress`/`In Review`) issues unassigned.
- One issue = one branch (`feature/ANT-XXX`) with a single owner agent.
- Before coding, check the last 5-10 entries in `NOTES.md` and all active `In Progress` / `In Review` issues for overlap.
- If two issues touch the same subsystem, leave cross-links in both Linear issues before implementation.

## Small-task criteria

Skip the planning gate only if **all** are true:
- no DB schema or migration changes
- no infra/deploy changes
- no auth/security-sensitive changes
- no AI protocol/prompt contract changes
- small scoped change (roughly up to 3 files and straightforward behavior)

If any condition is not true, treat as complex and go through `Planned`.

## Backlog / auxiliary states

- **`Ideas`** — raw ideas, unprioritized. Do not pick up unless Anton explicitly asks.
- **`Improvements`** — backlog polish tasks. Pick up only when assigned.
- **`AI Improvements`** — issues created from AI audits/plans (one issue per fix/feature).
- **`Canceled`** / **`Duplicate`** — terminal states; do not reopen.

## Global rules

- **Environments**: Staging = [staging.barrigame.es](https://staging.barrigame.es) (:3001), Prod = [barrigame.es](https://barrigame.es) (:3000).
- **Branching**: Feature work from `staging`, branch `feature/ANT-XXX`, delete after merge to `main`.
- **Auto-deploy**: Pushes to `staging` deploy staging; pushes to `main` deploy production through GitHub Actions.
- **Assignee swaps**: Self while working; Anton for `Planned` and `In Review`; self again for deploy/finalization.
- **Coordination**: Before starting, read last 5-10 entries in `NOTES.md`. If overlap exists, leave coordination comments in both related issues.
- **Post-deploy sync**: After each prod deploy, ensure `origin/main` and `origin/staging` are synchronized (same tree). If drift appears, fast-forward `staging` from `main` immediately or open explicit sync PR.
- **Project requirement**: Any new issue must be in project **Barri** (`ffeca0b2-16b3-4d2e-a7e6-0181ea2e991c`) and team **Anton_ux** (`c5959f1e-2ee7-4087-a234-20a44b69d8f0`).

## Linear API usage (API only)

Use GraphQL API directly for reads and writes:

```bash
# Claude
curl -s -H "Authorization: $CLAUDE_LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  https://api.linear.app/graphql \
  -d '{"query":"query { viewer { id name } }"}'

# Codex
curl -s -H "Authorization: $CODEX_LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  https://api.linear.app/graphql \
  -d '{"query":"query { viewer { id name } }"}'
```

If API access appears unavailable, verify in this order:
1. Load the right env file for the current machine (`./.env.linear.local` locally, `/opt/apps/.env` on VPS).
2. Check key mapping with `viewer` query:
   - `CLAUDE_LINEAR_API_KEY` → `Claude` (`4e483311-d106-4708-82a4-421812e84721`)
   - `CODEX_LINEAR_API_KEY` → `Codex` (`3f8713c1-72d2-4781-b3c0-1ed4e1017a4b`)
Only if the correct key is still unavailable or auth fails after that should you ask Anton to restore API access. Do not switch to MCP.
