// API cost tracking — prices loaded from DB (model_pricing table), cached 7 days
import sql from './db';

// ── Pricing cache ─────────────────────────────────────────────────────────────

type PricingMap = Record<string, Record<string, Record<string, number>>>;

// Hardcoded fallback — used if DB is unavailable or table not yet seeded
const FALLBACK_PRICING: PricingMap = {
  anthropic: {
    'claude-sonnet-4-6':           { inputPer1M: 3.00,  outputPer1M: 15.00 },
    'claude-haiku-4-5-20251001':   { inputPer1M: 0.80,  outputPer1M:  4.00 },
  },
  gemini: {
    'gemini-2.5-flash':            { inputPer1M: 0.30,  outputPer1M:  2.50 },
    'gemini-2.0-flash':            { inputPer1M: 0.10,  outputPer1M:  0.40 },
    'gemini-2.5-flash-preview-tts': { perChar: 0.000030 },
    'gemini-2.5-flash-image':      { perImage: 0.04 },
  },
  openai: {
    'tts-1':                       { perChar: 0.000015 },
    'whisper-1':                   { perMinute: 0.006 },
    'dall-e-2':                    { perImage: 0.02 },
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
  type: 'llm' | 'tts' | 'stt' | 'image' | 'summarize';
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  characters?: number;
  imageCount?: number;
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

  if (modelPricing.inputPer1M !== undefined && params.inputTokens !== undefined) {
    const inputCost = (params.inputTokens / 1_000_000) * modelPricing.inputPer1M;
    const outputCost = ((params.outputTokens ?? 0) / 1_000_000) * (modelPricing.outputPer1M ?? 0);
    return inputCost + outputCost;
  }
  if (modelPricing.perChar !== undefined && params.characters !== undefined) {
    return params.characters * modelPricing.perChar;
  }
  if (modelPricing.perImage !== undefined && params.imageCount !== undefined) {
    return params.imageCount * modelPricing.perImage;
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

export async function getModelBreakdown() {
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
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY provider, model, type
    ORDER BY total_cost DESC NULLS LAST
  `;
  return rows as unknown as {
    provider: string; model: string; type: string;
    calls: number; input_tokens: number | null; output_tokens: number | null;
    characters: number | null; image_count: number | null; total_cost: number;
  }[];
}

export async function getSessionBreakdown() {
  const rows = await sql`
    SELECT
      gs.name                          AS session_name,
      gs.scenario_id,
      au.session_id,
      COUNT(*)::int                    AS calls,
      SUM(au.cost_usd)::float          AS total_cost,
      MAX(au.created_at)               AS last_used
    FROM api_usage au
    JOIN game_sessions gs ON gs.id = au.session_id
    WHERE au.created_at > NOW() - INTERVAL '30 days'
      AND au.session_id IS NOT NULL
    GROUP BY gs.name, gs.scenario_id, au.session_id
    ORDER BY total_cost DESC NULLS LAST
    LIMIT 20
  `;
  return rows as unknown as {
    session_name: string; scenario_id: string; session_id: string;
    calls: number; total_cost: number; last_used: string;
  }[];
}
