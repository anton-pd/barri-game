// ANT-63: ruleset-driven stat resolution for players.
// The Player type still carries legacy CoC fields (hp/sanity/luck) for backward compat,
// while generic `stats` (Record<statId, {value, max}>) is the canonical source for
// non-CoC systems. This helper unifies both views so prompt, parser, and UI can
// render any ruleset without hardcoding stat ids.
import type { Player, RulesetStatDef } from '@/types';
import { RULESETS } from './rulesets';

export interface StatView {
  id: string;
  label: string;
  color: string;
  hasMax: boolean;
  value: number;
  max: number | null;
}

export function getRulesetStatDefs(rulesetId?: string | null): RulesetStatDef[] {
  const r = rulesetId ? RULESETS[rulesetId] : undefined;
  return r?.stats ?? RULESETS.coc_7e.stats;
}

function legacyValue(player: Player, id: string): { value: number; max: number | null } | null {
  if (id === 'hp')     return { value: player.hp,     max: player.maxHp     ?? null };
  if (id === 'sanity') return { value: player.sanity, max: player.maxSanity ?? null };
  if (id === 'luck')   return { value: player.luck,   max: player.maxLuck   ?? null };
  return null;
}

export function resolvePlayerStats(player: Player, rulesetId?: string | null): StatView[] {
  const defs = getRulesetStatDefs(rulesetId);
  return defs.map((def) => {
    const generic = player.stats?.[def.id];
    if (generic) {
      return {
        id: def.id, label: def.label, color: def.color, hasMax: def.hasMax,
        value: generic.value,
        max: def.hasMax ? generic.max : null,
      };
    }
    const legacy = legacyValue(player, def.id);
    if (legacy) {
      return {
        id: def.id, label: def.label, color: def.color, hasMax: def.hasMax,
        value: legacy.value,
        max: def.hasMax ? legacy.max : null,
      };
    }
    return {
      id: def.id, label: def.label, color: def.color, hasMax: def.hasMax,
      value: def.defaultValue,
      max: def.hasMax ? def.defaultValue : null,
    };
  });
}

// Apply a DELTA map to a player. Keys may be any ruleset-defined stat id —
// legacy CoC hp/sanity/luck still work because they are ids in the coc_7e ruleset.
export function applyDeltaToPlayer(
  player: Player,
  rulesetId: string | undefined | null,
  delta: Record<string, number>
): Player {
  const defs = getRulesetStatDefs(rulesetId);
  const byId = new Map(defs.map((d) => [d.id, d]));
  const resolvedByIdBefore = new Map(resolvePlayerStats(player, rulesetId).map((s) => [s.id, s]));

  let next: Player = { ...player, stats: { ...(player.stats ?? {}) } };

  for (const [key, raw] of Object.entries(delta)) {
    const def = byId.get(key);
    if (!def) continue;
    const amount = Number(raw) || 0;
    if (amount === 0) continue;

    const current = resolvedByIdBefore.get(key)!;
    const nextValue = def.hasMax && current.max !== null
      ? Math.max(0, Math.min(current.max, current.value + amount))
      : Math.max(0, current.value + amount);

    next.stats = { ...(next.stats ?? {}), [key]: { value: nextValue, max: current.max } };
    // Mirror into legacy CoC fields so older UI/types that read them stay consistent.
    if (key === 'hp')     next = { ...next, hp:     nextValue };
    if (key === 'sanity') next = { ...next, sanity: nextValue };
    if (key === 'luck')   next = { ...next, luck:   nextValue };
  }

  return next;
}

// Compose the stat-line portion of the prompt, e.g. "HP 10/12 SAN 60/65 LUCK 40/50"
// or "Brains 10 Brawn 6 …" for non-CoC rulesets.
export function formatStatLine(player: Player, rulesetId?: string | null): string {
  return resolvePlayerStats(player, rulesetId)
    .map((s) => s.hasMax && s.max !== null ? `${s.label} ${s.value}/${s.max}` : `${s.label} ${s.value}`)
    .join(' ');
}

// DELTA instruction template for the prompt — lists the stat ids the keeper may
// mutate for this ruleset so the LLM can emit a well-formed tag.
export function buildDeltaTemplate(rulesetId?: string | null): string {
  const defs = getRulesetStatDefs(rulesetId);
  const body = defs.map((d) => `"${d.id}":<±N>`).join(',');
  return `[DELTA:{"<idx>":{${body}}}]`;
}
