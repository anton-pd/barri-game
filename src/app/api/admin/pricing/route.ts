import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { invalidatePricingCache } from '@/lib/costTracker';
import { ensureSchema } from '@/lib/queries';
import { requireAdminUser } from '@/lib/serverAuth';

export async function GET() {
  if (!(await requireAdminUser())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureSchema();
  const rows = await sql`
    SELECT provider, model, metric, value_usd::float AS value_usd, updated_at
    FROM model_pricing
    ORDER BY provider, model, metric
  `;
  return NextResponse.json(rows);
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdminUser())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureSchema();
  const body = await req.json() as { provider: string; model: string; metric: string; value_usd: number };
  const { provider, model, metric, value_usd } = body;

  if (
    !provider
    || !model
    || !metric
    || typeof value_usd !== 'number'
    || !Number.isFinite(value_usd)
    || value_usd < 0
  ) {
    return NextResponse.json(
      { error: 'provider, model, metric and a non-negative finite value_usd are required' },
      { status: 400 }
    );
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
