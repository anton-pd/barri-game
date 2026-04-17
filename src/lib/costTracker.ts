// API cost tracking — prices loaded from DB (model_pricing table), cached 7 days
import sql from './db';

export type Period = 'today' | 'week' | 'month' | 'all' | 'custom';

function periodFilter(period: Period, date?: string) {
  switch (period) {
    case 'today': return sql`created_at >= CURRENT_DATE`;
    case 'week': return sql`created_at >= date_trunc('week', NOW())`;
    case 'month': return sql`created_at >= date_trunc('month', NOW())`;
    case 'custom': return date ? sql`DATE(created_at) = ${date}::date` : sql`created_at > NOW() - INTERVAL '30 days'`;
    default: return sql`TRUE`; // 'all'
  }
}

// ── Pricing cache ─────────────────────────────────────────────────────────────

type PricingMap = Record<string, Record<string, Record<string, number>>>;

// Hardcoded fallback — used if DB is unavailable or table not yet seeded
const FALLBACK_PRICING: PricingMap = {
  anthropic: {
    'claude-sonnet-4-6': { inputPer1M: 3.00, outputPer1M: 15.00 },
    'claude-haiku-4-5-20251001': { inputPer1M: 0.80, outputPer1M: 4.00 },
  },
  gemini: {
    'gemini-2.5-flash': { inputPer1M: 0.30, outputPer1M: 2.50 },
    'gemini-2.5-flash-preview-tts': { inputPer1M: 0.50, outputPer1M: 2.00 }, // $0.50 text in + $2.00 audio out per 1M tokens
    'gemini-2.5-flash-image': { perImage: 0.04, inputPer1M: 0.30 }, // image + prompt input tokens
  },
  openai: {
    'tts-1': { perChar: 0.000015 },
    'whisper-1': { perMinute: 0.006 },
    'dall-e-2': { perImage: 0.02 },
  },
};

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let cachedPricing: PricingMap | null = null;
let cacheLoadedAt = 0;

async function loadPricing(): Promise<PricingMap> {
  if (cachedPricing && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedPricing;
  }
  try {
    const rows = await sql<{ provider: string; model: string; metric: string; value_usd: string }[]>`
      SELECT provider, model, metric, value_usd FROM model_pricing
    `;
    if (rows.length === 0) return FALLBACK_PRICING;

    const map: PricingMap = {};
    for (const row of rows) {
      map[row.provider] ??= {};
      map[row.provider][row.model] ??= {};
      map[row.provider][row.model][row.metric] = parseFloat(row.value_usd);
    }
    cachedPricing = map;
    cacheLoadedAt = Date.now();
    return map;
  } catch {
    return FALLBACK_PRICING;
  }
}

/** Invalidate in-memory cache (call after admin update). */
export function invalidatePricingCache() {
  cachedPricing = null;
  cacheLoadedAt = 0;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface TrackParams {
  sessionId?: string;
  campaignId?: string;
  userId: string;
  provider: string;
  type: 'llm' | 'tts' | 'stt' | 'image' | 'ambient' | 'summarize';
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  characters?: number;
  imageCount?: number;
  duration?: number; // seconds — for STT (whisper billing is per minute)
}

export async function trackAPICall(params: TrackParams): Promise<void> {
  try {
    const costUSD = await calculateCost(params);
    await sql`
      INSERT INTO api_usage
        (session_id, campaign_id, user_id, provider, type, model,
         input_tokens, output_tokens, characters, image_count, cost_usd)
      VALUES (
        ${params.sessionId ?? null},
        ${params.campaignId ?? null},
        ${params.userId},
        ${params.provider},
        ${params.type},
        ${params.model},
        ${params.inputTokens ?? null},
        ${params.outputTokens ?? null},
        ${params.characters ?? null},
        ${params.imageCount ?? null},
        ${costUSD}
      )
    `;
  } catch (err) {
    // Cost tracking is non-critical — log and continue
    console.error('[costTracker] Failed to track API call:', err);
  }
}

async function calculateCost(params: TrackParams): Promise<number> {
  const pricing = await loadPricing();
  const modelPricing = pricing[params.provider]?.[params.model];
  if (!modelPricing) return 0;

  // Use params.type to pick the right billing formula — avoids ambiguity when a model
  // has both inputPer1M and perImage (e.g. gemini-2.5-flash-image)
  if (params.type === 'image') {
    let cost = 0;
    if (modelPricing.perImage !== undefined && params.imageCount !== undefined) {
      cost += params.imageCount * modelPricing.perImage;
    }
    // Prompt input tokens are also billed on image generation (Google charges for them)
    if (modelPricing.inputPer1M !== undefined && params.inputTokens) {
      cost += (params.inputTokens / 1_000_000) * modelPricing.inputPer1M;
    }
    return cost;
  }

  if (params.type === 'llm' || params.type === 'summarize') {
    if (modelPricing.inputPer1M === undefined || params.inputTokens === undefined) return 0;
    const inputCost = (params.inputTokens / 1_000_000) * modelPricing.inputPer1M;
    const outputCost = ((params.outputTokens ?? 0) / 1_000_000) * (modelPricing.outputPer1M ?? 0);
    return inputCost + outputCost;
  }

  if (params.type === 'tts') {
    // Token-based billing (Gemini TTS: separate input/output token pricing)
    if (modelPricing.inputPer1M !== undefined && params.inputTokens !== undefined) {
      const inputCost  = (params.inputTokens  / 1_000_000) * modelPricing.inputPer1M;
      const outputCost = ((params.outputTokens ?? 0) / 1_000_000) * (modelPricing.outputPer1M ?? 0);
      return inputCost + outputCost;
    }
    // Character-based billing (OpenAI TTS)
    if (modelPricing.perChar !== undefined && params.characters !== undefined) {
      return params.characters * modelPricing.perChar;
    }
  }

  if (params.type === 'ambient' && modelPricing.perChar !== undefined && params.characters !== undefined) {
    return params.characters * modelPricing.perChar;
  }

  if (params.type === 'stt' && modelPricing.perMinute !== undefined && params.duration !== undefined) {
    return (params.duration / 60) * modelPricing.perMinute;
  }

  return 0;
}

// ── Aggregates for admin dashboard ───────────────────────────────────────────

export async function getSessionCosts(sessionId: string) {
  const result = await sql`
    SELECT
      provider, type, model,
      SUM(input_tokens)::bigint  AS total_input,
      SUM(output_tokens)::bigint AS total_output,
      SUM(cost_usd)::float       AS total_cost,
      COUNT(*)::int              AS call_count
    FROM api_usage WHERE session_id = ${sessionId}
    GROUP BY provider, type, model
    ORDER BY total_cost DESC
  `;
  return result;
}

export async function getUserCosts(userId: string, days = 30) {
  const result = await sql`
    SELECT
      DATE(created_at)                    AS date,
      SUM(cost_usd)::float                AS daily_cost,
      COUNT(DISTINCT session_id)::int     AS sessions
    FROM api_usage
    WHERE user_id = ${userId}
      AND created_at > NOW() - (${days} || ' days')::INTERVAL
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `;
  return result;
}

export async function getAdminOverview() {
  const result = await sql`
    SELECT
      u.email,
      COUNT(DISTINCT au.session_id)::int  AS session_count,
      SUM(au.cost_usd)::float             AS total_cost,
      MAX(au.created_at)                  AS last_active
    FROM api_usage au
    JOIN users u ON u.id = au.user_id
    WHERE au.created_at > NOW() - INTERVAL '30 days'
    GROUP BY u.email
    ORDER BY total_cost DESC
  `;
  return result;
}

export async function getModelBreakdown(period: Period = 'month', date?: string) {
  const pf = periodFilter(period, date);
  const rows = await sql`
    SELECT
      provider,
      model,
      type,
      COUNT(*)::int                  AS calls,
      SUM(input_tokens)::bigint      AS input_tokens,
      SUM(output_tokens)::bigint     AS output_tokens,
      SUM(characters)::bigint        AS characters,
      SUM(image_count)::int          AS image_count,
      SUM(cost_usd)::float           AS total_cost
    FROM api_usage
    WHERE ${pf}
    GROUP BY provider, model, type
    ORDER BY total_cost DESC NULLS LAST
  `;
  return rows as unknown as {
    provider: string; model: string; type: string;
    calls: number; input_tokens: number | null; output_tokens: number | null;
    characters: number | null; image_count: number | null; total_cost: number;
  }[];
}

export interface SessionModelRow {
  session_id: string; provider: string; model: string; type: string;
  calls: number; input_tokens: number | null; output_tokens: number | null;
  characters: number | null; image_count: number | null; cost: number;
}

export interface EnhancedSessionRow {
  session_name: string; scenario_id: string; session_id: string;
  player_count: number; message_count: number; keeper_message_count: number;
  calls: number; total_cost: number;
  avg_output_tokens: number | null; avg_input_tokens: number | null;
  last_used: string;
  models: SessionModelRow[];
}

export async function getSessionBreakdownEnhanced(): Promise<EnhancedSessionRow[]> {
  const sessionRows = await sql`
    SELECT
      gs.name                                          AS session_name,
      gs.scenario_id,
      gs.id                                            AS session_id,
      jsonb_array_length(gs.players)                   AS player_count,
      COALESCE(msg_agg.message_count, 0)::int          AS message_count,
      COALESCE(msg_agg.keeper_message_count, 0)::int   AS keeper_message_count,
      au_agg.calls,
      au_agg.total_cost,
      au_agg.avg_output_tokens,
      au_agg.avg_input_tokens,
      au_agg.last_used
    FROM game_sessions gs
    JOIN (
      SELECT
        session_id,
        COUNT(*)::int                                                    AS calls,
        SUM(cost_usd)::float                                             AS total_cost,
        AVG(CASE WHEN type = 'llm' THEN output_tokens END)::float        AS avg_output_tokens,
        AVG(CASE WHEN type = 'llm' THEN input_tokens  END)::float        AS avg_input_tokens,
        MAX(created_at)                                                  AS last_used
      FROM api_usage
      WHERE session_id IS NOT NULL
      GROUP BY session_id
    ) au_agg ON au_agg.session_id = gs.id
    LEFT JOIN (
      SELECT
        session_id,
        COUNT(*)::int                                        AS message_count,
        COUNT(CASE WHEN role = 'assistant' THEN 1 END)::int  AS keeper_message_count
      FROM messages
      GROUP BY session_id
    ) msg_agg ON msg_agg.session_id = gs.id
    ORDER BY au_agg.total_cost DESC NULLS LAST
    LIMIT 50
  `;

  if (sessionRows.length === 0) return [];

  const sessionIds = (sessionRows as unknown as { session_id: string }[]).map(r => r.session_id);

  const modelRows = await sql`
    SELECT
      session_id,
      provider, model, type,
      COUNT(*)::int           AS calls,
      SUM(input_tokens)::bigint  AS input_tokens,
      SUM(output_tokens)::bigint AS output_tokens,
      SUM(characters)::bigint    AS characters,
      SUM(image_count)::int      AS image_count,
      SUM(cost_usd)::float       AS cost
    FROM api_usage
    WHERE session_id = ANY(${sessionIds})
    GROUP BY session_id, provider, model, type
    ORDER BY cost DESC NULLS LAST
  `;

  const modelsBySession = new Map<string, SessionModelRow[]>();
  for (const m of modelRows as unknown as SessionModelRow[]) {
    const sid = m.session_id;
    if (!modelsBySession.has(sid)) modelsBySession.set(sid, []);
    modelsBySession.get(sid)!.push(m);
  }

  return (sessionRows as unknown as EnhancedSessionRow[]).map(s => ({
    ...s,
    models: modelsBySession.get(s.session_id) ?? [],
  }));
}

export interface AccountModelRow {
  user_id: string; provider: string; model: string; type: string;
  calls: number; input_tokens: number | null; output_tokens: number | null;
  characters: number | null; image_count: number | null; cost: number;
}

export interface AccountRow {
  user_id: string; email: string; session_count: number;
  total_cost: number; last_active: string;
  models: AccountModelRow[];
}

export interface ScenarioRow {
  scenario_id: string;
  session_count: number;
  completed_count: number;
  avg_messages: number;
  total_cost: number;
  avg_cost_per_session: number;
  avg_rating: number | null;
  rating_count: number;
}

export async function getScenarioBreakdown(): Promise<ScenarioRow[]> {
  const rows = await sql`
    SELECT
      gs.scenario_id,
      COUNT(DISTINCT gs.id)::int                                             AS session_count,
      COUNT(DISTINCT CASE WHEN gs.status = 'completed' THEN gs.id END)::int AS completed_count,
      COALESCE(AVG(msg_agg.message_count), 0)::float                        AS avg_messages,
      COALESCE(SUM(au_agg.session_cost), 0)::float                          AS total_cost,
      COALESCE(AVG(au_agg.session_cost), 0)::float                          AS avg_cost_per_session,
      AVG(sf.rating)::float                                                 AS avg_rating,
      COUNT(sf.session_id)::int                                             AS rating_count
    FROM game_sessions gs
    LEFT JOIN session_feedback sf ON sf.session_id = gs.id
    LEFT JOIN (
      SELECT session_id, SUM(cost_usd) AS session_cost
      FROM api_usage
      WHERE session_id IS NOT NULL
      GROUP BY session_id
    ) au_agg ON au_agg.session_id = gs.id
    LEFT JOIN (
      SELECT session_id, COUNT(*) AS message_count
      FROM messages
      GROUP BY session_id
    ) msg_agg ON msg_agg.session_id = gs.id
    GROUP BY gs.scenario_id
    ORDER BY total_cost DESC NULLS LAST
  `;
  return rows as unknown as ScenarioRow[];
}

export async function getAccountsBreakdown(period: Period = 'month', date?: string): Promise<AccountRow[]> {
  const pf = periodFilter(period, date);

  const accountRows = await sql`
    SELECT
      u.id                                       AS user_id,
      u.email,
      COUNT(DISTINCT au.session_id)::int         AS session_count,
      SUM(au.cost_usd)::float                    AS total_cost,
      MAX(au.created_at)                         AS last_active
    FROM api_usage au
    JOIN users u ON u.id = au.user_id
    WHERE ${pf}
    GROUP BY u.id, u.email
    ORDER BY total_cost DESC NULLS LAST
  `;

  if (accountRows.length === 0) return [];

  const modelRows = await sql`
    SELECT
      user_id,
      provider, model, type,
      COUNT(*)::int              AS calls,
      SUM(input_tokens)::bigint  AS input_tokens,
      SUM(output_tokens)::bigint AS output_tokens,
      SUM(characters)::bigint    AS characters,
      SUM(image_count)::int      AS image_count,
      SUM(cost_usd)::float       AS cost
    FROM api_usage
    WHERE ${pf}
    GROUP BY user_id, provider, model, type
    ORDER BY cost DESC NULLS LAST
  `;

  const modelsByUser = new Map<string, AccountModelRow[]>();
  for (const m of modelRows as unknown as AccountModelRow[]) {
    const uid = m.user_id;
    if (!modelsByUser.has(uid)) modelsByUser.set(uid, []);
    modelsByUser.get(uid)!.push(m);
  }

  return (accountRows as unknown as AccountRow[]).map(a => ({
    ...a,
    models: modelsByUser.get(a.user_id) ?? [],
  }));
}
