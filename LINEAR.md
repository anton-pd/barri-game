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

Assignee is always **Anton**. Claude acts under the Claude account.

## Labels

| Label | ID | Use |
|-------|----|-----|
| `planned` | `df5d1957-5972-401a-9391-ed8058181d49` | Task planned, not started |
| `in-execution` | `8cec9395-1235-48db-ab2d-f43be7a80882` | Actively being worked on |
| `review` | `2092c19e-a36e-49bb-8249-06643034d121` | Done, waiting for Anton review |

## Workflow — step by step

```
Todo → In Progress → Done
```

| Step | Who | Action |
|------|-----|--------|
| 1 | Claude | Set status → **In Progress**, assignee → Anton |
| 2 | Claude | Post **plan comment** to the issue (files affected, approach, why) |
| 3 | Anton | Approves plan (or requests changes) |
| 4 | Claude | Implements the work |
| 5 | Claude | Commit + `git push` |
| 6 | Claude | Update **CHANGELOG.md** and **NOTES.md** |
| 7 | Claude | Post **summary comment** (problem → solution → result → commit hash) |
| 8 | Claude | Set status → **Done** (assignee stays Anton) |
| 9 | Anton | Reviews and confirms |

**Rules:**
- Always post the plan comment **before writing any code**
- Assignee is always Anton, never Claude
- Claude sets Done — Anton only reviews
- Summary comment format: problem → solution → result → commit hash

## MCP Auth on VPS

Linear MCP requires OAuth each session:

1. Call `mcp__linear-server__authenticate` → get URL
2. Open URL in **local browser**, authorize
3. Copy the URL from address bar (connection error is normal)
4. Call `mcp__linear-server__complete_authentication` with that URL
