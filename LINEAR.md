# Linear Workflow — barrigame.es (Barri project)

## Project info

- **Project:** Barri — ID `ffeca0b2-16b3-4d2e-a7e6-0181ea2e991c`
- **Team:** Anton_ux — ID `c5959f1e-2ee7-4087-a234-20a44b69d8f0`
- **MCP server:** `https://mcp.linear.app/mcp` (configured in `~/.claude/settings.json`)

## Identities

| Person | Linear ID |
|--------|-----------|
| Anton | `2399a9db-92ac-4eb1-ab38-942cfa9a53f3` |
| Claude | `4e483311-d106-4708-82a4-421812e84721` |
| Codex | `TBD` |

Assignee is always **Anton**. Claude acts under the Claude account.

## Labels

| Label | ID | Use |
|-------|----|-----|
| `planned` | `df5d1957-5972-401a-9391-ed8058181d49` | Task planned, not started |
| `in-execution` | `8cec9395-1235-48db-ab2d-f43be7a80882` | Actively being worked on |
| `review` | `2092c19e-a36e-49bb-8249-06643034d121` | Done, waiting for Anton review |

## Workflow — States & Actions

| **Todo** | Any AI | **AI** (Self) | Fetch task (assigned to self) | `git checkout staging` |
| **Planned** | Claude | **Anton** | Post technical plan (if complex) | - |
| **In Progress** | Claude | **AI** (Self) | Implementation & local testing | `git checkout -b feature/*` |
| **In Review** | Claude | **Anton** | Merge feature → staging, deploy | `git merge staging` |
| **Ready for Deployment** | Any AI | **AI** (Self) | Anton approved review | `git checkout main` |
| **Deployed / Done** | Any AI | **AI** (Self) | Final Merge → main, push, Update Prod | `git push` |

**Rules:**
- **Staging Site**: [staging.barrigame.es](https://staging.barrigame.es) (Port 3001)
- **Production Site**: [barrigame.es](https://barrigame.es) (Port 3000)
- **Cleanup**: Delete feature branches after merging into `main`.
- **Commit Format**: `ANT-XXX: summary`. Commit only before moving to **In Review**.
- **Finalize**: When task transitions to **Ready for Deployment**, AI merges `staging` to `main`, pushes to GitHub, updates prod folder, move task to **Done** (keep on self).
- **Assignee**: AI assigns task to **self** when starting. Assign back to **Anton** for Plan Approval (`Planned`) or Review (`In Review`).
- **Identity**: Claude takes tasks assigned to **Claude**. Codex takes tasks assigned to **Codex**.
- **AI Improvements**: When asked for plans/audits, AI creates issues in **AI Improvements** column (1 issue per fix/feature) with descriptions and assigns to self.

## MCP Auth on VPS

Linear MCP requires OAuth each session:

1. Call `mcp__linear-server__authenticate` → get URL
2. Open URL in **local browser**, authorize
3. Copy the URL from address bar (connection error is normal)
4. Call `mcp__linear-server__complete_authentication` with that URL
