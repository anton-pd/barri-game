#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const API_URL = 'https://api.linear.app/graphql';

const IDS = {
  project: 'ffeca0b2-16b3-4d2e-a7e6-0181ea2e991c',
  team: 'c5959f1e-2ee7-4087-a234-20a44b69d8f0',
  users: {
    anton: '2399a9db-92ac-4eb1-ab38-942cfa9a53f3',
    claude: '4e483311-d106-4708-82a4-421812e84721',
    codex: '3f8713c1-72d2-4781-b3c0-1ed4e1017a4b',
  },
  states: {
    todo: '717e0207-b107-478e-b660-ea0dd0b1ac78',
    planned: 'c475cb47-841b-40e2-8fcd-2b30a8664467',
    inProgress: 'f4380255-1dd2-4ced-8cbe-ec475d6b9e52',
    inReview: 'c5dc90f8-3f6e-4632-aaca-d8709f1c037d',
  },
  labels: {
    planned: 'df5d1957-5972-401a-9391-ed8058181d49',
    inExecution: '8cec9395-1235-48db-ab2d-f43be7a80882',
    review: '2092c19e-a36e-49bb-8249-06643034d121',
    bug: 'd3f0b884-3595-492e-adec-db89ac9a59cc',
    improvement: 'c1f6231c-8492-44e1-b41f-fdc8ed781bee',
    feature: '37601284-f1ae-441a-a292-ddf25fc3d097',
    smallTask: '3d20a1e6-bd24-4115-9fb6-af9f545fd943',
  },
};

const ENV_CANDIDATES = [
  path.resolve(process.cwd(), '.env.linear.local'),
  '/Users/anton.leshchenko/Projects/Barri/.env.linear.local',
  '/opt/apps/.env',
];

function parseEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadEnv() {
  for (const file of ENV_CANDIDATES) {
    const env = parseEnvFile(file);
    for (const [key, value] of Object.entries(env)) {
      if (process.env[key] == null) process.env[key] = value;
    }
  }
}

function argValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? '';
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function agentName() {
  const value = argValue('--agent') ?? process.env.LINEAR_AGENT ?? 'codex';
  if (!['codex', 'claude'].includes(value)) {
    throw new Error(`Unsupported --agent "${value}". Use codex or claude.`);
  }
  return value;
}

function apiKeyFor(agent) {
  const keyName = agent === 'claude' ? 'CLAUDE_LINEAR_API_KEY' : 'CODEX_LINEAR_API_KEY';
  const key = process.env[keyName];
  if (!key) {
    throw new Error(`Missing ${keyName}. Run npm run codex:bootstrap or create .env.linear.local.`);
  }
  return key;
}

async function gql(query, variables = {}) {
  const key = apiKeyFor(agentName());
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors?.length) {
    const message = json.errors?.map((e) => e.message).join('; ') || `${res.status} ${res.statusText}`;
    throw new Error(message);
  }
  return json.data;
}

async function readStdinIfAvailable() {
  if (process.stdin.isTTY) return '';
  let body = '';
  for await (const chunk of process.stdin) body += chunk;
  return body.trim();
}

async function bodyFromArgs() {
  const inline = argValue('--body');
  if (inline != null) return inline;
  const file = argValue('--body-file');
  if (file) return fs.readFileSync(path.resolve(file), 'utf8').trim();
  return readStdinIfAvailable();
}

function mergeLabels(issue, additions, removals = []) {
  const ids = new Set(issue.labels.nodes.map((label) => label.id));
  for (const id of removals) ids.delete(id);
  for (const id of additions) ids.add(id);
  return [...ids];
}

async function getIssue(issueId) {
  const data = await gql(
    `query($id: String!) {
      issue(id: $id) {
        id identifier title priority url description createdAt updatedAt
        state { id name type }
        assignee { id displayName name }
        labels { nodes { id name } }
      }
    }`,
    { id: issueId },
  );
  if (!data.issue) throw new Error(`Issue not found: ${issueId}`);
  return data.issue;
}

async function updateIssue(id, input) {
  const data = await gql(
    `mutation($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
        issue {
          identifier title url
          state { name }
          assignee { displayName name }
          labels { nodes { name } }
        }
      }
    }`,
    { id, input },
  );
  return data.issueUpdate.issue;
}

async function comment(issueId, body) {
  if (!body.trim()) throw new Error('Comment body is empty. Pass --body, --body-file, or pipe stdin.');
  const data = await gql(
    `mutation($issueId: String!, $body: String!) {
      commentCreate(input: { issueId: $issueId, body: $body }) {
        success
        comment { id }
      }
    }`,
    { issueId, body },
  );
  return data.commentCreate.comment.id;
}

function printIssue(issue) {
  console.log(`${issue.identifier} | ${issue.state.name} | ${issue.assignee?.displayName ?? 'unassigned'} | ${issue.title}`);
  console.log(issue.url);
  const labels = issue.labels.nodes.map((label) => label.name).join(', ');
  if (labels) console.log(`labels: ${labels}`);
}

async function cmdViewer() {
  const data = await gql('query { viewer { id name displayName email } }');
  if (hasFlag('--json')) console.log(JSON.stringify(data.viewer, null, 2));
  else console.log(`${data.viewer.displayName ?? data.viewer.name} (${data.viewer.id})`);
}

async function cmdMine() {
  const agent = agentName();
  const data = await gql(
    `query($team: ID!, $project: ID!, $assignee: ID!) {
      issues(first: 50, orderBy: updatedAt, filter: {
        team: { id: { eq: $team } }
        project: { id: { eq: $project } }
        assignee: { id: { eq: $assignee } }
        state: { name: { in: ["Todo", "In Progress", "In Review", "Planned", "Ready for deploy"] } }
      }) {
        nodes {
          identifier title url updatedAt
          state { name }
          assignee { displayName name }
          labels { nodes { name } }
        }
      }
    }`,
    { team: IDS.team, project: IDS.project, assignee: IDS.users[agent] },
  );
  for (const issue of data.issues.nodes) {
    const labels = issue.labels.nodes.map((label) => label.name).join(', ');
    console.log(`${issue.identifier}\t${issue.state.name}\t${issue.assignee?.displayName ?? 'unassigned'}\t${issue.title}${labels ? `\t[${labels}]` : ''}`);
  }
}

async function cmdIssue(issueId) {
  printIssue(await getIssue(issueId));
}

async function cmdTake(issueId) {
  const issue = await getIssue(issueId);
  const agent = agentName();
  const additions = [IDS.labels.inExecution];
  const smallReason = argValue('--small');
  if (smallReason != null) additions.push(IDS.labels.smallTask);
  const updated = await updateIssue(issue.id, {
    stateId: IDS.states.inProgress,
    assigneeId: IDS.users[agent],
    labelIds: mergeLabels(issue, additions, [IDS.labels.planned, IDS.labels.review]),
  });
  printIssue(updated);
  if (smallReason != null) {
    const reason = smallReason.trim() || 'Small task: no DB, infra, auth/security, or AI protocol changes expected; scope is narrow and straightforward.';
    await comment(issue.id, reason);
    console.log('small-task comment posted');
  }
}

async function cmdPlan(issueId) {
  const issue = await getIssue(issueId);
  const body = await bodyFromArgs();
  const updated = await updateIssue(issue.id, {
    stateId: IDS.states.planned,
    assigneeId: IDS.users.anton,
    labelIds: mergeLabels(issue, [IDS.labels.planned], [IDS.labels.inExecution, IDS.labels.review, IDS.labels.smallTask]),
  });
  printIssue(updated);
  const commentId = await comment(issue.id, body);
  console.log(`plan comment posted: ${commentId}`);
}

async function cmdComment(issueId) {
  const issue = await getIssue(issueId);
  const commentId = await comment(issue.id, await bodyFromArgs());
  console.log(`comment posted: ${commentId}`);
}

async function main() {
  loadEnv();
  const command = process.argv[2];
  const issueId = process.argv[3];
  if (!command || ['-h', '--help', 'help'].includes(command)) {
    console.log(`Usage:
  npm run linear -- viewer [--json]
  npm run linear -- mine [--agent codex|claude]
  npm run linear -- issue ANT-123
  npm run linear -- take ANT-123 [--small "reason"]
  npm run linear -- plan ANT-123 --body-file plan.md
  echo "note" | npm run linear -- comment ANT-123

Environment is loaded from ./.env.linear.local, /Users/anton.leshchenko/Projects/Barri/.env.linear.local, then /opt/apps/.env.`);
    return;
  }

  if (command === 'viewer') return cmdViewer();
  if (command === 'mine') return cmdMine();
  if (!issueId) throw new Error(`${command} requires an issue id, e.g. ANT-180`);
  if (command === 'issue') return cmdIssue(issueId);
  if (command === 'take') return cmdTake(issueId);
  if (command === 'plan') return cmdPlan(issueId);
  if (command === 'comment') return cmdComment(issueId);
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`linear: ${error.message}`);
  process.exit(1);
});
