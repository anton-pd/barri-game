'use client';

import type { Player } from '@/types';

interface StatsBarProps {
  players: Player[];
  onUpdatePlayers: (players: Player[]) => void;
}

export default function StatsBar({ players, onUpdatePlayers }: StatsBarProps) {
  function updateStat(idx: number, stat: 'hp' | 'sanity', value: number) {
    const updated = players.map((p, i) => {
      if (i !== idx) return p;
      return {
        ...p,
        [stat]: Math.max(0, Math.min(stat === 'hp' ? 10 : 99, value)),
      };
    });
    onUpdatePlayers(updated);
  }

  return (
    <div className="flex flex-wrap gap-3 p-3 bg-stone-900 border-b border-stone-700">
      {players.map((player, idx) => (
        <div key={idx} className="flex-1 min-w-[140px] bg-stone-800 rounded-lg p-2">
          <div className="text-xs text-stone-400 mb-1 truncate">{player.name}</div>
          <div className="text-xs text-stone-500 mb-2 truncate">{player.role}</div>

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-red-400 w-6">HP</span>
              <button
                onClick={() => updateStat(idx, 'hp', player.hp - 1)}
                className="w-5 h-5 text-xs bg-stone-700 hover:bg-stone-600 rounded text-stone-300 flex items-center justify-center"
              >
                -
              </button>
              <span className="text-xs text-red-300 w-8 text-center font-mono">
                {player.hp}/10
              </span>
              <button
                onClick={() => updateStat(idx, 'hp', player.hp + 1)}
                className="w-5 h-5 text-xs bg-stone-700 hover:bg-stone-600 rounded text-stone-300 flex items-center justify-center"
              >
                +
              </button>
              <div className="flex gap-0.5 ml-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-sm ${i < player.hp ? 'bg-red-500' : 'bg-stone-700'}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-xs text-purple-400 w-6">SAN</span>
              <button
                onClick={() => updateStat(idx, 'sanity', player.sanity - 1)}
                className="w-5 h-5 text-xs bg-stone-700 hover:bg-stone-600 rounded text-stone-300 flex items-center justify-center"
              >
                -
              </button>
              <span className="text-xs text-purple-300 w-8 text-center font-mono">
                {player.sanity}/99
              </span>
              <button
                onClick={() => updateStat(idx, 'sanity', player.sanity + 1)}
                className="w-5 h-5 text-xs bg-stone-700 hover:bg-stone-600 rounded text-stone-300 flex items-center justify-center"
              >
                +
              </button>
              <div className="flex gap-0.5 ml-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-sm ${i < Math.floor(player.sanity / 10) ? 'bg-purple-500' : 'bg-stone-700'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
