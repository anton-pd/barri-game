# Linear Workflow — barrigame.es (Barri project)

## Project info

- **Project:** Barri — ID `ffeca0b2-16b3-4d2e-a7e6-0181ea2e991c`
- **Team:** Anton_ux (key `ANT`) — ID `c5959f1e-2ee7-4087-a234-20a44b69d8f0`
- **MCP server:** `https://mcp.linear.app/mcp` (configured in `~/.claude/settings.json`)
- **API key fallback:** `LINEAR_API_KEY` in `/opt/apps/.env` — use when MCP OAuth is unavailable (direct GraphQL at `https://api.linear.app/graphql`).

## Identities (team members)

| Person | Display name | Linear ID |
|--------|--------------|-----------|
| Anton Leshchenko | `toxaker` | `2399a9db-92ac-4eb1-ab38-942cfa9a53f3` |
| Claude | `claude` | `4e483311-d106-4708-82a4-421812e84721` |
| Codex | `codex` | `3f8713c1-72d2-4781-b3c0-1ed4e1017a4b` |

**Identity rule:** Claude takes tasks assigned to **Claude**. Codex takes tasks assigned to **Codex**. Never pick up the other agent's tasks.

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

## Task lifecycle (main flow)

| Step | From state | → To state | Who moves | Assignee after move | AI action |
|------|-----------|-----------|-----------|---------------------|-----------|
| 1 | `Todo` | `In Progress` | Claude/Codex | **Self** (AI) | `git checkout staging && git pull` |
| 2 | `In Progress` | `Planned` *(if complex)* | Claude/Codex | **Anton** | Post technical plan as issue comment, wait for approval |
| 3 | `Planned` | `In Progress` | Anton | **Self** (AI) | `git checkout -b feature/ANT-XXX` |
| 4 | `In Progress` | `In Review` | Claude/Codex | **Anton** | Commit → merge feature → `staging` → push → verify on [staging.barrigame.es](https://staging.barrigame.es) |
| 5 | `In Review` | `Ready for deploy` | Anton | **Self** (AI) | — (Anton approved review) |
| 6 | `Ready for deploy` | `Done` | Claude/Codex | **Self** (AI) | Merge `staging` → `main`, push, update prod folder, restart container |

**Small tasks** (label `small-task`, or obvious fix): skip step 2 (no plan review). Document reasoning in the Linear comment.

## Backlog / auxiliary states

- **`Ideas`** — raw ideas, unprioritized. Do not pick up unless Anton explicitly tells you to.
- **`Improvements`** — polish / nice-to-have backlog. Pick up only when Anton assigns you.
- **`AI Improvements`** — *AI-created* audit / plan issues. When Anton asks for a plan or audit, create issues here (1 per fix/feature), assign to self, and prioritize later through normal flow.
- **`Canceled`** / **`Duplicate`** — terminal states; don't reopen, leave a comment instead.

## Rules

- **Environments**: Staging = [staging.barrigame.es](https://staging.barrigame.es) (:3001), Prod = [barrigame.es](https://barrigame.es) (:3000).
- **Branches**: Feature work from `staging`, name `feature/ANT-XXX`. Delete branch after merging into `main`.
- **Commit format**: `ANT-XXX: summary`. Commit only before moving to `In Review`.
- **Mandatory updates** (every task, same commit): `NOTES.md` (append journal entry) + `CHANGELOG.md` (user-facing entry under version).
- **Review comment** (mandatory): When moving a task to `In Review`, always post a Linear comment on the task summarizing: what was done, key decisions, and link to the staging URL to verify. No exceptions.
- **Assignee swaps**: AI → Self when working; AI → Anton for **`Planned`** (plan approval) and **`In Review`** (final review).
- **Coordination**: Before starting, read last 5-10 entries in `NOTES.md` to see what the other agent touched. If overlap, leave a Linear comment on both tasks.
- **Project requirement**: Any new issue MUST live in the **Barri** project (`ffeca0b2-16b3-4d2e-a7e6-0181ea2e991c`) in team **Anton_ux** (`c5959f1e-2ee7-4087-a234-20a44b69d8f0`).

## Linear access from this VPS

Two options, in order of preference:

### 1. MCP server (preferred)
Linear MCP requires OAuth each session:

1. Call `mcp__linear-server__authenticate` → get URL
2. Open URL in **local browser**, authorize
3. Copy the URL from address bar (connection error is normal)
4. Call `mcp__linear-server__complete_authentication` with that URL

### 2. Direct GraphQL (fallback, no OAuth)
When MCP isn't available, use `LINEAR_API_KEY` from `/opt/apps/.env`:

```bash
curl -s -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  https://api.linear.app/graphql \
  -d '{"query":"query { issues(first: 20, filter: {project: {id: {eq: \"ffeca0b2-16b3-4d2e-a7e6-0181ea2e991c\"}}, assignee: {id: {eq: \"4e483311-d106-4708-82a4-421812e84721\"}}}) { nodes { identifier title state { name } } } }"}'
```

Use this for read-only queries when checking what's on your plate. State changes and comments should still prefer MCP when possible.
