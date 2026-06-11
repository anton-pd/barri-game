/**
 * ANT-142 follow-up — TTFT + prompt-cache benchmark: DeepSeek direct vs OpenRouter.
 *
 * Speed/cache only (no quality scoring): replays one realistic deep-history
 * prompt (~18K input) N times per arm, measuring TTFT, total time, cached
 * tokens and reported cost. Runs 2..N should hit each provider's prompt cache.
 *
 * Usage: npx tsx scripts/eval/bench-openrouter.ts [--runs 3]
 * Keys from env: DEEPSEEK_API_KEY, OPENROUTER_API_KEY.
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildSystemPromptBlocks } from '@/lib/prompts';
import type { Player, Scenario, WorldState } from '@/types';

const FIXTURES = path.join(__dirname, 'fixtures');
const SCENARIOS_DIR = '/opt/apps/shared_data/scenarios';
const MAX_TOKENS = 400; // TTFT doesn't depend on output length; keep runs short

// ── Prompt (same shape as run-eval / prod split-tail) ────────────────────────

function buildMessages(): { role: string; content: string }[] {
  const session = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'session_1ec276ae.json'), 'utf8')) as {
    scenario_id: string; world_state: WorldState; players: Player[];
  };
  const messages = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'messages_1ec276ae.json'), 'utf8')) as {
    role: 'user' | 'assistant'; content: string; player_idx: number | null;
  }[];
  const scenario = JSON.parse(fs.readFileSync(path.join(SCENARIOS_DIR, `${session.scenario_id}.json`), 'utf8')) as Scenario;
  const blocks = buildSystemPromptBlocks(scenario, session.world_state, session.players, { language: 'uk' });
  const history = messages.slice(-30).map((m) => {
    if (m.role === 'user' && m.player_idx !== null && session.players[m.player_idx]) {
      return { role: 'user', content: `[${session.players[m.player_idx].name}]: ${m.content}` };
    }
    return { role: m.role, content: m.content };
  });
  return [
    { role: 'system', content: `${blocks.ruleset}\n\n${blocks.static}` },
    ...history,
    { role: 'user', content: `[СТАН СЕСІЇ]\n${blocks.dynamic}` },
    { role: 'assistant', content: 'Зрозумів.' },
    { role: 'user', content: '[Тестер Антон]: Я уважно оглядаю телеграфний апарат — шукаю сліди стороннього втручання.' },
  ];
}

// ── Arms ─────────────────────────────────────────────────────────────────────

interface Arm {
  key: string;
  url: string;
  apiKeyEnv: string;
  model: string;
  provider?: string; // OpenRouter provider pin
}

const ARMS: Arm[] = [
  { key: 'direct', url: 'https://api.deepseek.com/chat/completions', apiKeyEnv: 'DEEPSEEK_API_KEY', model: 'deepseek-v4-flash' },
  { key: 'or-auto', url: 'https://openrouter.ai/api/v1/chat/completions', apiKeyEnv: 'OPENROUTER_API_KEY', model: 'deepseek/deepseek-v4-flash' },
  { key: 'or-cloudflare', url: 'https://openrouter.ai/api/v1/chat/completions', apiKeyEnv: 'OPENROUTER_API_KEY', model: 'deepseek/deepseek-v4-flash', provider: 'Cloudflare' },
  { key: 'or-novita', url: 'https://openrouter.ai/api/v1/chat/completions', apiKeyEnv: 'OPENROUTER_API_KEY', model: 'deepseek/deepseek-v4-flash', provider: 'Novita' },
  { key: 'or-parasail', url: 'https://openrouter.ai/api/v1/chat/completions', apiKeyEnv: 'OPENROUTER_API_KEY', model: 'deepseek/deepseek-v4-flash', provider: 'Parasail' },
  { key: 'or-atlascloud', url: 'https://openrouter.ai/api/v1/chat/completions', apiKeyEnv: 'OPENROUTER_API_KEY', model: 'deepseek/deepseek-v4-flash', provider: 'AtlasCloud' },
  { key: 'or-gmicloud', url: 'https://openrouter.ai/api/v1/chat/completions', apiKeyEnv: 'OPENROUTER_API_KEY', model: 'deepseek/deepseek-v4-flash', provider: 'GMICloud' },
  { key: 'or-baidu', url: 'https://openrouter.ai/api/v1/chat/completions', apiKeyEnv: 'OPENROUTER_API_KEY', model: 'deepseek/deepseek-v4-flash', provider: 'Baidu' },
];

interface RunResult {
  ttftMs: number | null;
  totalMs: number;
  promptTokens: number;
  cachedTokens: number;
  costUsd: number | null;
  servedBy: string | null;
  error?: string;
}

async function runOnce(arm: Arm, messages: { role: string; content: string }[]): Promise<RunResult> {
  const apiKey = process.env[arm.apiKeyEnv];
  if (!apiKey) throw new Error(`${arm.apiKeyEnv} not set`);
  const isOR = arm.url.includes('openrouter');
  const body: Record<string, unknown> = {
    model: arm.model,
    messages,
    max_tokens: MAX_TOKENS,
    temperature: 1.0,
    stream: true,
    stream_options: { include_usage: true },
  };
  if (isOR) {
    body.usage = { include: true };
    if (arm.provider) body.provider = { order: [arm.provider], allow_fallbacks: false };
  }

  const start = Date.now();
  const res = await fetch(arm.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    return { ttftMs: null, totalMs: Date.now() - start, promptTokens: 0, cachedTokens: 0, costUsd: null, servedBy: null, error: `${res.status} ${(await res.text()).slice(0, 150)}` };
  }

  let ttftMs: number | null = null;
  let servedBy: string | null = null;
  let promptTokens = 0;
  let cachedTokens = 0;
  let costUsd: number | null = null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
      try {
        const chunk = JSON.parse(line.slice(6));
        if (ttftMs === null && chunk.choices?.[0]?.delta?.content) ttftMs = Date.now() - start;
        if (chunk.provider) servedBy = chunk.provider;
        const u = chunk.usage;
        if (u) {
          promptTokens = u.prompt_tokens ?? promptTokens;
          // DeepSeek direct: prompt_cache_hit_tokens; OpenRouter (OpenAI shape): prompt_tokens_details.cached_tokens
          cachedTokens = u.prompt_cache_hit_tokens ?? u.prompt_tokens_details?.cached_tokens ?? cachedTokens;
          if (typeof u.cost === 'number') costUsd = u.cost;
        }
      } catch { /* partial line */ }
    }
  }
  return { ttftMs, totalMs: Date.now() - start, promptTokens, cachedTokens, costUsd, servedBy };
}

async function main() {
  const args = process.argv.slice(2);
  const runs = args.includes('--runs') ? Number(args[args.indexOf('--runs') + 1]) : 3;
  const armsArg = args.includes('--arms') ? args[args.indexOf('--arms') + 1].split(',') : null;
  const messages = buildMessages();
  const approxInput = Math.round(messages.reduce((n, m) => n + m.content.length, 0) / 4);
  console.log(`Bench: ${ARMS.length} arms × ${runs} runs, ~${approxInput} input tokens, max_tokens ${MAX_TOKENS}\n`);

  const arms = armsArg ? ARMS.filter((a) => armsArg.includes(a.key)) : ARMS;
  const results: Record<string, RunResult[]> = {};
  for (const arm of arms) {
    results[arm.key] = [];
    for (let i = 0; i < runs; i++) {
      process.stdout.write(`${arm.key} run ${i + 1}/${runs} ... `);
      try {
        const r = await runOnce(arm, messages);
        results[arm.key].push(r);
        console.log(r.error ? `ERROR: ${r.error}` : `ttft ${r.ttftMs}ms total ${r.totalMs}ms cached ${r.cachedTokens}/${r.promptTokens}${r.servedBy ? ` via ${r.servedBy}` : ''}${r.costUsd !== null ? ` $${r.costUsd.toFixed(6)}` : ''}`);
      } catch (e) {
        results[arm.key].push({ ttftMs: null, totalMs: 0, promptTokens: 0, cachedTokens: 0, costUsd: null, servedBy: null, error: String(e).slice(0, 150) });
        console.log(`ERROR: ${String(e).slice(0, 120)}`);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const outFile = path.join(__dirname, `bench_or_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`);
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\nSaved: ${outFile}`);

  console.log(`\n${'arm'.padEnd(15)}${'TTFT warm (run2+)'.padEnd(20)}${'TTFT cold (run1)'.padEnd(18)}${'cache hit run2+'.padEnd(17)}servedBy`);
  for (const arm of arms) {
    const rs = results[arm.key].filter((r) => !r.error);
    if (!rs.length) { console.log(`${arm.key.padEnd(15)}all failed`); continue; }
    const warm = rs.slice(1).map((r) => r.ttftMs).filter((x): x is number => x !== null);
    const cold = rs[0]?.ttftMs;
    const warmTtft = warm.length ? Math.round(warm.reduce((a, b) => a + b, 0) / warm.length) : null;
    const cacheWarm = rs.slice(1).map((r) => `${Math.round((r.cachedTokens / Math.max(1, r.promptTokens)) * 100)}%`).join(',');
    console.log(`${arm.key.padEnd(15)}${String(warmTtft ?? '—').padEnd(20)}${String(cold ?? '—').padEnd(18)}${cacheWarm.padEnd(17)}${rs[rs.length - 1].servedBy ?? '—'}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
