// CHANGED: New file — API cost tracking wrapper
import sql from './db';

const PRICING: Record<string, Record<string, Record<string, number>>> = {
  anthropic: {
    'claude-sonnet-4-6':           { inputPer1M: 3.00,  outputPer1M: 15.00 },
    'claude-haiku-4-5-20251001':   { inputPer1M: 0.80,  outputPer1M:  4.00 },
  },
  gemini: {
    'gemini-2.5-flash':            { inputPer1M: 0.10,  outputPer1M:  0.40 },
    'gemini-2.5-pro':              { inputPer1M: 1.25,  outputPer1M:  5.00 },
    'gemini-2.5-flash-preview-tts': { perChar: 0.000030 },
    'gemini-2.5-flash-image':      { perImage: 0.04 },
  },
  openai: {
    'tts-1':                       { perChar: 0.000015 },
    'whisper-1':                   { perMinute: 0.006 },
    'dall-e-2':                    { perImage: 0.02 },
  },
};

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
    const costUSD = calculateCost(params);
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

function calculateCost(params: TrackParams): number {
  const providerPricing = PRICING[params.provider]?.[params.model];
  if (!providerPricing) return 0;

  if (providerPricing.inputPer1M !== undefined && params.inputTokens !== undefined) {
    const inputCost = (params.inputTokens / 1_000_000) * providerPricing.inputPer1M;
    const outputCost = ((params.outputTokens ?? 0) / 1_000_000) * (providerPricing.outputPer1M ?? 0);
    return inputCost + outputCost;
  }
  if (providerPricing.perChar !== undefined && params.characters !== undefined) {
    return params.characters * providerPricing.perChar;
  }
  if (providerPricing.perImage !== undefined && params.imageCount !== undefined) {
    return params.imageCount * providerPricing.perImage;
  }
  return 0;
}

// Aggregates for admin dashboard
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
