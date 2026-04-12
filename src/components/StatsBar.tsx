'use client';

import { useState } from 'react';
import type { Player } from '@/types';

interface StatsBarProps {
  players: Player[];
  onUpdatePlayers: (players: Player[]) => void;
  onUseItem?: (playerIdx: number, itemId: string, itemName: string) => void;
}

export default function StatsBar({ players, onUpdatePlayers, onUseItem }: StatsBarProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  function updateStat(idx: number, stat: 'hp' | 'sanity' | 'luck', delta: number) {
    const updated = players.map((p, i) => {
      if (i !== idx) return p;
      const max = stat === 'hp' ? p.maxHp : stat === 'sanity' ? p.maxSanity : (p.maxLuck ?? 99);
      return { ...p, [stat]: Math.max(0, Math.min(max, (p[stat] ?? 0) + delta)) };
    });
    onUpdatePlayers(updated);
  }

  return (
    <div className="bg-stone-900 border-b border-stone-700">
      <div className="flex flex-wrap gap-2 p-2">
        {players.map((p, idx) => {
          const hpPct   = p.maxHp     > 0 ? p.hp     / p.maxHp              : 0;
          const sanPct  = p.maxSanity > 0 ? p.sanity / p.maxSanity          : 0;
          const maxLuck = p.maxLuck ?? 99;
          const luckPct = maxLuck    > 0 ? (p.luck ?? 0) / maxLuck          : 0;
          const isOpen  = expanded === idx;
          const inventory = p.inventory ?? [];

          return (
            <div
              key={idx}
              className="flex-1 min-w-[160px] bg-stone-800 rounded-lg overflow-hidden"
            >
              {/* Header row */}
              <button
                onClick={() => setExpanded(isOpen ? null : idx)}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-stone-700 transition-colors"
              >
                <div className="text-left">
                  <span className="text-xs font-medium text-stone-200">{p.name}</span>
                  <span className="text-xs text-stone-500 ml-1">· {p.role}</span>
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

              {/* HP + Sanity + Luck bars */}
              <div className="px-3 pb-2 space-y-1.5">
                {[
                  { key: 'hp'     as const, label: 'HP',  pct: hpPct,   val: p.hp,           max: p.maxHp,           colors: ['#ef4444','#f97316','#991b1b'], textColor: 'text-red-400',    valColor: 'text-red-300',    hoverMinus: 'hover:bg-red-900'    },
                  { key: 'sanity' as const, label: 'SAN', pct: sanPct,  val: p.sanity,        max: p.maxSanity,       colors: ['#a855f7','#7c3aed','#4c1d95'], textColor: 'text-purple-400', valColor: 'text-purple-300', hoverMinus: 'hover:bg-purple-900' },
                  { key: 'luck'   as const, label: 'LCK', pct: luckPct, val: p.luck ?? 0,     max: maxLuck,           colors: ['#f59e0b','#d97706','#92400e'], textColor: 'text-amber-400',  valColor: 'text-amber-300',  hoverMinus: 'hover:bg-amber-900'  },
                ].map(({ key, label, pct, val, max, colors, textColor, valColor, hoverMinus }) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className={`text-xs ${textColor} w-7 shrink-0`}>{label}</span>
                    <button
                      onClick={() => updateStat(idx, key, -1)}
                      className={`w-5 h-5 text-xs bg-stone-700 ${hoverMinus} rounded flex items-center justify-center text-stone-300 shrink-0`}
                    >−</button>
                    <div className="flex-1 bg-stone-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct * 100}%`,
                          backgroundColor: pct > 0.5 ? colors[0] : pct > 0.25 ? colors[1] : colors[2],
                        }}
                      />
                    </div>
                    <span className={`text-xs ${valColor} font-mono w-10 text-right shrink-0`}>
                      {val}/{max}
                    </span>
                    <button
                      onClick={() => updateStat(idx, key, +1)}
                      className="w-5 h-5 text-xs bg-stone-700 hover:bg-green-900 rounded flex items-center justify-center text-stone-300 shrink-0"
                    >+</button>
                  </div>
                ))}
              </div>

              {/* Expanded: skills + inventory */}
              {isOpen && (
                <>
                  {/* Skills */}
                  {p.skills && Object.keys(p.skills).length > 0 && (
                    <div className="border-t border-stone-700 px-3 py-2">
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

                  {/* Inventory */}
                  {inventory.length > 0 && (
                    <div className="border-t border-stone-700 px-3 py-2">
                      <p className="text-xs text-stone-500 mb-1.5 font-medium">Інвентар</p>
                      <div className="space-y-1.5">
                        {inventory.map((item) => {
                          const exhausted = item.uses === 0;
                          return (
                            <div
                              key={item.id}
                              className={`flex items-start justify-between gap-2 rounded px-2 py-1.5 ${exhausted ? 'bg-stone-800 opacity-50' : 'bg-stone-750'}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs font-medium ${exhausted ? 'text-stone-500' : 'text-stone-200'}`}>
                                    {item.name}
                                  </span>
                                  <span className="text-xs text-stone-600 shrink-0">
                                    {item.uses === -1 ? '∞' : `×${item.uses}`}
                                  </span>
                                </div>
                                <p className="text-xs text-stone-500 mt-0.5 leading-tight">{item.description}</p>
                              </div>
                              {!exhausted && onUseItem && (
                                <button
                                  onClick={() => {
                                    onUseItem(idx, item.id, item.name);
                                    setExpanded(null);
                                  }}
                                  className="text-xs px-1.5 py-0.5 bg-amber-900 hover:bg-amber-800 text-amber-300 rounded shrink-0 transition-colors"
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
