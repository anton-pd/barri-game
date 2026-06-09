import type { CasePlan, CasePlanItem, CasePlanItemStatus, WorldState } from '@/types';

const VALID_STATUSES = new Set<CasePlanItemStatus>([
  'hidden',
  'available',
  'completed',
  'crossed_out',
]);

interface CasePlanTagPayload {
  id?: unknown;
  label?: unknown;
  status?: unknown;
  note?: unknown;
}

function normalizeId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const id = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return id || null;
}

function normalizeStatus(value: unknown): CasePlanItemStatus {
  if (typeof value !== 'string') return 'available';
  return VALID_STATUSES.has(value as CasePlanItemStatus)
    ? (value as CasePlanItemStatus)
    : 'available';
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function upsertCasePlanItem(plan: CasePlan | undefined, payload: CasePlanTagPayload): CasePlan | undefined {
  const id = normalizeId(payload.id);
  if (!id) return plan;

  const items = [...(plan?.items ?? [])];
  const existingIndex = items.findIndex((item) => item.id === id);
  const existing = existingIndex >= 0 ? items[existingIndex] : null;
  const label = normalizeOptionalText(payload.label) ?? existing?.label;
  const note = normalizeOptionalText(payload.note) ?? existing?.note;

  if (!label) return plan;

  const nextItem: CasePlanItem = {
    id,
    label,
    status: normalizeStatus(payload.status ?? existing?.status),
    ...(note ? { note } : {}),
  };

  if (existingIndex >= 0) {
    items[existingIndex] = nextItem;
  } else {
    items.push(nextItem);
  }

  return { items };
}

export function applyCasePlanTags(
  text: string,
  worldState: WorldState
): { cleanText: string; worldState: WorldState } {
  let nextPlan = worldState.casePlan;

  const cleanText = text.replace(/\[CASE_PLAN:([^\]]*)\]/g, (_full, rawJson: string) => {
    try {
      const payload = JSON.parse(rawJson) as CasePlanTagPayload;
      nextPlan = upsertCasePlanItem(nextPlan, payload);
    } catch {
      // Malformed plan tags are data-only; strip them from narration either way.
    }
    return '';
  });

  if (nextPlan === worldState.casePlan) {
    return { cleanText, worldState };
  }

  return {
    cleanText,
    worldState: {
      ...worldState,
      casePlan: nextPlan,
    },
  };
}
