'use client';

import { useState } from 'react';
import type { Player } from '@/types';

interface StatsBarProps {
  players: Player[];
  onUpdatePlayers: (players: Player[]) => void;
}

export default function StatsBar({ players, onUpdatePlayers }: StatsBarProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  function updateStat(idx: number, stat: 'hp' | 'sanity', delta: number) {
    const updated = players.map((p, i) => {
      if (i !== idx) return p;
      const max = stat === 'hp' ? p.maxHp : p.maxSanity;
      return { ...p, [stat]: Math.max(0, Math.min(max, p[stat] + delta)) };
    });
    onUpdatePlayers(updated);
  }

  return (
    <div className="bg-stone-900 border-b border-stone-700">
      <div className="flex flex-wrap gap-2 p-2">
        {players.map((p, idx) => {
          const hpPct  = p.maxHp     > 0 ? p.hp     / p.maxHp     : 0;
          const sanPct = p.maxSanity > 0 ? p.sanity / p.maxSanity : 0;
          const isOpen = expanded === idx;

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
                <span className="text-stone-600 text-xs">{isOpen ? '▲' : '▼'}</span>
              </button>

              {/* HP + Sanity bars */}
              <div className="px-3 pb-2 space-y-1.5">
                {/* HP */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-red-400 w-7 shrink-0">HP</span>
                  <button
                    onClick={() => updateStat(idx, 'hp', -1)}
                    className="w-5 h-5 text-xs bg-stone-700 hover:bg-red-900 rounded flex items-center justify-center text-stone-300 shrink-0"
                  >−</button>
                  <div className="flex-1 bg-stone-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${hpPct * 100}%`,
                        backgroundColor: hpPct > 0.5 ? '#ef4444' : hpPct > 0.25 ? '#f97316' : '#991b1b',
                      }}
                    />
                  </div>
                  <span className="text-xs text-red-300 font-mono w-10 text-right shrink-0">
                    {p.hp}/{p.maxHp}
                  </span>
                  <button
                    onClick={() => updateStat(idx, 'hp', +1)}
                    className="w-5 h-5 text-xs bg-stone-700 hover:bg-green-900 rounded flex items-center justify-center text-stone-300 shrink-0"
                  >+</button>
                </div>

                {/* Sanity */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-purple-400 w-7 shrink-0">SAN</span>
                  <button
                    onClick={() => updateStat(idx, 'sanity', -1)}
                    className="w-5 h-5 text-xs bg-stone-700 hover:bg-purple-900 rounded flex items-center justify-center text-stone-300 shrink-0"
                  >−</button>
                  <div className="flex-1 bg-stone-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${sanPct * 100}%`,
                        backgroundColor: sanPct > 0.5 ? '#a855f7' : sanPct > 0.25 ? '#7c3aed' : '#4c1d95',
                      }}
                    />
                  </div>
                  <span className="text-xs text-purple-300 font-mono w-10 text-right shrink-0">
                    {p.sanity}/{p.maxSanity}
                  </span>
                  <button
                    onClick={() => updateStat(idx, 'sanity', +1)}
                    className="w-5 h-5 text-xs bg-stone-700 hover:bg-green-900 rounded flex items-center justify-center text-stone-300 shrink-0"
                  >+</button>
                </div>
              </div>

              {/* Skills (expandable) */}
              {isOpen && p.skills && Object.keys(p.skills).length > 0 && (
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
