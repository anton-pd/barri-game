'use client';

import { useState, useEffect, useRef } from 'react';
import type { WorldState } from '@/types';

interface DiceRollerProps {
  pendingRoll: NonNullable<WorldState['pendingRollResult']>;
  onResult: (result: number) => void;
}

export default function DiceRoller({ pendingRoll, onResult }: DiceRollerProps) {
  const [phase, setPhase]           = useState<'idle' | 'rolling' | 'done'>('idle');
  const [tensDisplay, setTensDisplay]   = useState(0);
  const [unitsDisplay, setUnitsDisplay] = useState(0);
  const [finalTens, setFinalTens]   = useState(0);
  const [finalUnits, setFinalUnits] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useEffect(() => {
    setPhase('idle');
  }, [pendingRoll.skillName, pendingRoll.goodThreshold]);

  function roll() {
    if (phase !== 'idle') return;

    // Result determined before animation starts
    const tens  = Math.floor(Math.random() * 10);
    const units = Math.floor(Math.random() * 10);
    setFinalTens(tens);
    setFinalUnits(units);
    setPhase('rolling');

    const duration = 1600;
    let elapsed = 0;
    let interval = 50;

    function tick() {
      elapsed += interval;
      setTensDisplay(Math.floor(Math.random() * 10));
      setUnitsDisplay(Math.floor(Math.random() * 10));

      if (elapsed >= duration) {
        setTensDisplay(tens);
        setUnitsDisplay(units);
        setPhase('done');
        return;
      }
      if (elapsed > duration - 600) interval = Math.min(220, interval * 1.2);
      timerRef.current = setTimeout(tick, interval);
    }

    timerRef.current = setTimeout(tick, interval);
  }

  const total     = finalTens === 0 && finalUnits === 0 ? 100 : finalTens * 10 + finalUnits;
  const isSuccess = phase === 'done' && total <= pendingRoll.goodThreshold;

  return (
    <div className="px-4 pt-3 pb-3 bg-stone-900 border-t border-stone-800">
      {/* Skill context */}
      <p className="text-xs text-center text-stone-500 mb-3">
        <span className="text-amber-400 font-medium">{pendingRoll.skillName}</span>
        {' — кинь ≤ '}
        <span className="text-amber-300 font-mono font-semibold">{pendingRoll.goodThreshold}</span>
        {pendingRoll.context && (
          <span className="text-stone-600">{' · '}{pendingRoll.context}</span>
        )}
      </p>

      {/* Dice row */}
      <div className="flex items-center justify-center gap-3">
        {/* Tens */}
        <div className="flex flex-col items-center gap-1">
          <div className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center bg-stone-800 transition-colors ${phase === 'rolling' ? 'border-amber-600' : phase === 'done' ? 'border-stone-500' : 'border-stone-700'}`}>
            <span className="font-mono text-2xl font-bold text-stone-100">
              {phase === 'idle' ? '–' : (tensDisplay * 10).toString().padStart(2, '0')}
            </span>
          </div>
          <span className="text-[10px] text-stone-600 uppercase tracking-wider">десятки</span>
        </div>

        <span className="text-stone-700 text-lg pb-5">+</span>

        {/* Units */}
        <div className="flex flex-col items-center gap-1">
          <div className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center bg-stone-800 transition-colors ${phase === 'rolling' ? 'border-amber-600' : phase === 'done' ? 'border-stone-500' : 'border-stone-700'}`}>
            <span className="font-mono text-2xl font-bold text-stone-100">
              {phase === 'idle' ? '–' : unitsDisplay}
            </span>
          </div>
          <span className="text-[10px] text-stone-600 uppercase tracking-wider">одиниці</span>
        </div>

        {/* Result */}
        {phase === 'done' && (
          <>
            <span className="text-stone-700 text-lg pb-5">=</span>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center ${isSuccess ? 'bg-green-900/30 border-green-600' : 'bg-red-900/20 border-red-700'}`}>
                <span className={`font-mono text-2xl font-bold ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
                  {total}
                </span>
              </div>
              <span className={`text-[10px] uppercase tracking-wider font-medium ${isSuccess ? 'text-green-500' : 'text-red-500'}`}>
                {isSuccess ? 'успіх' : 'провал'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Action */}
      <div className="flex justify-center mt-4">
        {phase === 'idle' && (
          <button
            onClick={roll}
            className="px-6 py-2 bg-amber-900 hover:bg-amber-800 active:bg-amber-950 rounded-xl text-sm font-medium text-amber-100 border border-amber-700/50 transition-colors"
          >
            🎲 Кинути
          </button>
        )}
        {phase === 'rolling' && (
          <span className="text-xs text-stone-600 tracking-widest animate-pulse">котяться...</span>
        )}
        {phase === 'done' && (
          <button
            onClick={() => onResult(total)}
            className={`px-6 py-2 rounded-xl text-sm font-medium text-white border transition-colors ${isSuccess ? 'bg-green-800 hover:bg-green-700 border-green-600/50' : 'bg-red-900 hover:bg-red-800 border-red-700/50'}`}
          >
            {isSuccess ? '✓ Успіх' : '✗ Провал'} — надіслати {total}
          </button>
        )}
      </div>
    </div>
  );
}
