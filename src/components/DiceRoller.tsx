'use client';

import { useState, useEffect, useRef } from 'react';
import type { WorldState } from '@/types';

interface DiceRollerProps {
  pendingRoll: NonNullable<WorldState['pendingRollResult']>;
  onResult: (result: number) => void;
}

export default function DiceRoller({ pendingRoll, onResult }: DiceRollerProps) {
  const [phase, setPhase]       = useState<'idle' | 'rolling' | 'done'>('idle');
  const [tensDisplay, setTensDisplay] = useState(0);
  const [unitsDisplay, setUnitsDisplay] = useState(0);
  const [finalTens, setFinalTens]   = useState(0);
  const [finalUnits, setFinalUnits] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Reset when a new roll is requested
  useEffect(() => {
    setPhase('idle');
    setTensDisplay(0);
    setUnitsDisplay(0);
  }, [pendingRoll.skillName, pendingRoll.goodThreshold]);

  function rollDice() {
    if (phase !== 'idle') return;
    setPhase('rolling');

    const tens  = Math.floor(Math.random() * 10);
    const units = Math.floor(Math.random() * 10);
    setFinalTens(tens);
    setFinalUnits(units);

    const duration = 1600;
    let elapsed = 0;
    let interval = 45;

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
      // slow down in final 600ms
      if (elapsed > duration - 600) interval = Math.min(250, interval * 1.18);
      timerRef.current = setTimeout(tick, interval);
    }

    timerRef.current = setTimeout(tick, interval);
  }

  const total     = finalTens === 0 && finalUnits === 0 ? 100 : finalTens * 10 + finalUnits;
  const isSuccess = phase === 'done' && total <= pendingRoll.goodThreshold;

  function DieFace({ value, label, rolling }: { value: string; label: string; rolling: boolean }) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div
          className={[
            'w-16 h-16 rounded-xl border-2 flex items-center justify-center bg-stone-800 transition-colors duration-150 select-none',
            rolling
              ? 'border-amber-500 shadow-lg shadow-amber-900/60'
              : phase === 'done'
              ? 'border-stone-500'
              : 'border-stone-600',
          ].join(' ')}
        >
          <span className={`font-mono text-2xl font-bold transition-colors ${rolling ? 'text-amber-300' : 'text-stone-100'}`}>
            {value}
          </span>
        </div>
        <span className="text-[10px] text-stone-600 uppercase tracking-wider">{label}</span>
      </div>
    );
  }

  return (
    <div className="px-3 pt-3 pb-3 bg-stone-900 border-t border-stone-800">
      {/* Skill context */}
      <p className="text-xs text-center text-stone-500 mb-3">
        <span className="text-amber-400 font-medium">{pendingRoll.skillName}</span>
        {' — кинь ≤ '}
        <span className="text-amber-300 font-mono font-semibold">{pendingRoll.goodThreshold}</span>
        <span className="text-stone-600">{' · '}{pendingRoll.context}</span>
      </p>

      {/* Dice row */}
      <div className="flex items-center justify-center gap-3">
        <DieFace
          value={phase === 'idle' ? '0' : (tensDisplay * 10).toString().padStart(2, '0')}
          label="десятки"
          rolling={phase === 'rolling'}
        />

        <span className="text-stone-600 text-xl pb-5">+</span>

        <DieFace
          value={phase === 'idle' ? '0' : unitsDisplay.toString()}
          label="одиниці"
          rolling={phase === 'rolling'}
        />

        {phase === 'done' && (
          <>
            <span className="text-stone-600 text-xl pb-5">=</span>
            <div className="flex flex-col items-center gap-1">
              <div
                className={[
                  'w-16 h-16 rounded-xl border-2 flex items-center justify-center',
                  isSuccess ? 'border-green-500 bg-green-900/30' : 'border-red-600 bg-red-900/20',
                ].join(' ')}
              >
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
            onClick={rollDice}
            className="px-5 py-2 bg-amber-800 hover:bg-amber-700 active:bg-amber-900 rounded-xl text-sm font-medium text-white transition-colors"
          >
            🎲 Кинути
          </button>
        )}
        {phase === 'rolling' && (
          <span className="text-xs text-stone-500 animate-pulse tracking-widest">котяться...</span>
        )}
        {phase === 'done' && (
          <button
            onClick={() => onResult(total)}
            className={[
              'px-5 py-2 rounded-xl text-sm font-medium text-white transition-colors',
              isSuccess
                ? 'bg-green-700 hover:bg-green-600 active:bg-green-800'
                : 'bg-red-800 hover:bg-red-700 active:bg-red-900',
            ].join(' ')}
          >
            {isSuccess ? '✓ Успіх' : '✗ Провал'} — відправити {total}
          </button>
        )}
      </div>
    </div>
  );
}
