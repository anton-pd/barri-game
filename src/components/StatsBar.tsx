'use client';

import { useState } from 'react';
import type { Player } from '@/types';
import { resolvePlayerStats } from '@/lib/statUtils';

interface StatsBarProps {
  players: Player[];
  rulesetId?: string;
  onUpdatePlayers: (players: Player[]) => void;
  onUseItem?: (playerIdx: number, itemId: string, itemName: string) => void;
}

// Per-stat color gradient (foreground → dimmer shades). Keeps the existing
// visual feel for CoC while letting non-CoC rulesets fall back to a safe default.
const STAT_COLORS: Record<string, [string, string, string]> = {
  hp:     ['#ef4444','#f97316','#991b1b'],
  sanity: ['#a855f7','#7c3aed','#4c1d95'],
  luck:   ['#f59e0b','#d97706','#92400e'],
};
const DEFAULT_COLORS: [string, string, string] = ['#60a5fa','#3b82f6','#1e3a8a'];

export default function StatsBar({ players, rulesetId = 'coc_7e', onUpdatePlayers, onUseItem }: StatsBarProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  function updateStat(idx: number, statId: string, delta: number) {
    const updated = players.map((p, i) => {
      if (i !== idx) return p;
      const resolved = resolvePlayerStats(p, rulesetId).find((s) => s.id === statId);
      if (!resolved) return p;
      const nextValue = resolved.hasMax && resolved.max !== null
        ? Math.max(0, Math.min(resolved.max, resolved.value + delta))
        : Math.max(0, resolved.value + delta);
      const nextStats = { ...(p.stats ?? {}), [statId]: { value: nextValue, max: resolved.max } };
      const patch: Partial<Player> = { stats: nextStats };
      if (statId === 'hp')     patch.hp     = nextValue;
      if (statId === 'sanity') patch.sanity = nextValue;
      if (statId === 'luck')   patch.luck   = nextValue;
      return { ...p, ...patch };
    });
    onUpdatePlayers(updated);
  }

  return (
    <div className="bg-stone-900 border-b border-stone-800">
      <div className="flex flex-wrap gap-2 p-2">
        {players.map((p, idx) => {
          const stats = resolvePlayerStats(p, rulesetId);
          const isOpen = expanded === idx;
          const inventory = p.inventory ?? [];

          return (
            <div key={idx} className="flex-1 min-w-[160px] bg-stone-800/80 rounded-xl overflow-hidden border border-stone-700/50">
              <button
                onClick={() => setExpanded(isOpen ? null : idx)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-stone-700/50 active:bg-stone-700 transition-colors"
              >
                <div className="text-left">
                  <span className="text-xs font-semibold text-stone-200">{p.name}</span>
                  <span className="text-xs text-stone-500 ml-1.5">· {p.role}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {inventory.length > 0 && (
                    <span className="text-xs text-amber-700" title="Предмети">
                      🎒{inventory.length}
                    </span>
                  )}
                  <span className="text-stone-600 text-xs">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              <div className="px-3 pb-2.5 space-y-2">
                {stats.map((s) => {
                  const max = s.hasMax ? (s.max ?? 0) : 0;
                  const pct = s.hasMax && max > 0 ? s.value / max : 1;
                  const colors = STAT_COLORS[s.id] ?? DEFAULT_COLORS;
                  return (
                    <div key={s.id} className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium w-10 shrink-0" style={{ color: s.color }}>{s.label}</span>
                      <button
                        onClick={() => updateStat(idx, s.id, -1)}
                        className="w-7 h-7 text-sm bg-stone-700 hover:bg-red-900/60 active:scale-95 rounded-lg flex items-center justify-center text-stone-300 shrink-0 transition-all"
                      >−</button>
                      {s.hasMax ? (
                        <div className="flex-1 bg-stone-700/60 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${pct * 100}%`,
                              backgroundColor: pct > 0.5 ? colors[0] : pct > 0.25 ? colors[1] : colors[2],
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex-1 h-2.5" />
                      )}
                      <span className="text-[11px] font-mono w-10 text-right shrink-0" style={{ color: s.color }}>
                        {s.hasMax && s.max !== null ? `${s.value}/${s.max}` : s.value}
                      </span>
                      <button
                        onClick={() => updateStat(idx, s.id, +1)}
                        className="w-7 h-7 text-sm bg-stone-700 hover:bg-green-900/60 active:scale-95 rounded-lg flex items-center justify-center text-stone-300 shrink-0 transition-all"
                      >+</button>
                    </div>
                  );
                })}
              </div>

              {isOpen && (
                <>
                  {p.skills && Object.keys(p.skills).length > 0 && (
                    <div className="border-t border-stone-700/50 px-3 py-2.5">
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        {Object.entries(p.skills).map(([skill, val]) => (
                          <div key={skill} className="flex items-center justify-between">
                            <span className="text-xs text-stone-500 truncate">{skill}</span>
                            <span className="text-xs text-amber-600 font-mono ml-1 shrink-0">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {inventory.length > 0 && (
                    <div className="border-t border-stone-700/50 px-3 py-2.5">
                      <p className="text-xs text-stone-500 mb-2 font-medium uppercase tracking-wide">Інвентар</p>
                      <div className="space-y-1.5">
                        {inventory.map((item) => {
                          const exhausted = item.uses === 0;
                          const broken = item.broken;
                          const equipped = item.equipped;
                          const dimmed = exhausted || broken;
                          return (
                            <div
                              key={item.id}
                              className={`flex items-start justify-between gap-2 rounded-lg px-2.5 py-2 ${
                                broken
                                  ? 'bg-red-950/30 opacity-60'
                                  : exhausted
                                    ? 'bg-stone-800/50 opacity-50'
                                    : equipped
                                      ? 'bg-amber-950/40 border border-amber-800/40'
                                      : 'bg-stone-700/40'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {equipped && <span className="text-amber-500 text-xs shrink-0">⚔</span>}
                                  {broken && <span className="text-red-600 text-xs shrink-0">✕</span>}
                                  <span className={`text-xs font-medium ${dimmed ? 'text-stone-500' : 'text-stone-200'}`}>
                                    {item.name}
                                  </span>
                                  <span className="text-xs text-stone-600 shrink-0">
                                    {broken ? 'зламаний' : item.uses === -1 ? '∞' : `×${item.uses}`}
                                  </span>
                                </div>
                                <p className="text-xs text-stone-500 mt-0.5 leading-tight">{item.description}</p>
                              </div>
                              {!dimmed && onUseItem && (
                                <button
                                  onClick={() => {
                                    onUseItem(idx, item.id, item.name);
                                    setExpanded(null);
                                  }}
                                  className="text-xs px-2 py-1 bg-amber-900/60 hover:bg-amber-800 active:scale-95 text-amber-300 rounded-lg shrink-0 transition-all"
                                >
                                  вжити
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
