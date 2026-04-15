import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { invalidatePricingCache } from '@/lib/costTracker';
import { ensureSchema } from '@/lib/queries';

export async function GET() {
  await ensureSchema();
  const rows = await sql`
    SELECT provider, model, metric, value_usd::float AS value_usd, updated_at
    FROM model_pricing
    ORDER BY provider, model, metric
  `;
  return NextResponse.json(rows);
}

export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const body = await req.json() as { provider: string; model: string; metric: string; value_usd: number };
  const { provider, model, metric, value_usd } = body;

  if (!provider || !model || !metric || typeof value_usd !== 'number') {
    return NextResponse.json({ error: 'provider, model, metric, value_usd required' }, { status: 400 });
  }

  await sql`
    INSERT INTO model_pricing (provider, model, metric, value_usd, updated_at)
    VALUES (${provider}, ${model}, ${metric}, ${value_usd}, NOW())
    ON CONFLICT (provider, model, metric)
    DO UPDATE SET value_usd = EXCLUDED.value_usd, updated_at = NOW()
  `;

  invalidatePricingCache();

  return NextResponse.json({ ok: true });
}
