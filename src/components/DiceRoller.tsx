'use client';

import { useState, useEffect } from 'react';
import type { WorldState } from '@/types';

interface DiceRollerProps {
  pendingRoll: NonNullable<WorldState['pendingRollResult']>;
  onResult: (result: number) => void;
}

interface DieState {
  value: number;       // final value — determined at roll time, never changes
  rolling: boolean;
  settled: boolean;
}

function D10Die({
  die,
  label,
  delay,
}: {
  die: DieState;
  label: string;
  delay: number;
}) {
  const displayValue = die.settled
    ? (label === 'десятки' ? (die.value * 10).toString().padStart(2, '0') : die.value.toString())
    : '?';

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Die body — perspective wrapper */}
      <div style={{ perspective: '300px' }} className="w-20 h-20 flex items-center justify-center">
        <div
          className="relative w-16 h-16 flex items-center justify-center"
          style={
            die.rolling
              ? {
                  animation: `dice-drop 1.3s ${delay}ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards`,
                }
              : die.settled
              ? { transform: 'rotate(45deg) translateY(0) rotateX(748deg)' }
              : { transform: 'rotate(45deg)' }
          }
        >
          {/* Diamond face */}
          <div
            className={[
              'absolute inset-0 rounded-md border-2 transition-colors duration-300',
              die.settled
                ? 'bg-stone-800 border-stone-500'
                : die.rolling
                ? 'bg-stone-700 border-amber-600'
                : 'bg-stone-900 border-stone-700',
            ].join(' ')}
          />
          {/* Shadow while airborne */}
          {die.rolling && (
            <div className="absolute inset-0 rounded-md shadow-2xl shadow-amber-900/40" />
          )}
        </div>
        {/* Number — separate from rotating diamond so it stays readable */}
        {(die.rolling || die.settled) && (
          <span
            className={[
              'absolute font-mono font-bold select-none pointer-events-none transition-all',
              die.settled ? 'text-2xl text-stone-100' : 'text-xl text-stone-500',
            ].join(' ')}
            style={
              die.settled
                ? {
                    animation: 'dice-reveal 0.35s ease-out forwards',
                  }
                : {}
            }
          >
            {displayValue}
          </span>
        )}
      </div>
      <span className="text-[10px] text-stone-600 uppercase tracking-wider">{label}</span>
    </div>
  );
}

export default function DiceRoller({ pendingRoll, onResult }: DiceRollerProps) {
  const [phase, setPhase]   = useState<'idle' | 'rolling' | 'done'>('idle');
  const [tens, setTens]     = useState<DieState>({ value: 0, rolling: false, settled: false });
  const [units, setUnits]   = useState<DieState>({ value: 0, rolling: false, settled: false });

  // Reset when a new roll request comes in
  useEffect(() => {
    setPhase('idle');
    setTens({ value: 0, rolling: false, settled: false });
    setUnits({ value: 0, rolling: false, settled: false });
  }, [pendingRoll.skillName, pendingRoll.goodThreshold]);

  function roll() {
    if (phase !== 'idle') return;

    // Randomness first — values determined before any animation
    const tVal = Math.floor(Math.random() * 10);
    const uVal = Math.floor(Math.random() * 10);

    setPhase('rolling');
    setTens({ value: tVal, rolling: true, settled: false });
    setUnits({ value: uVal, rolling: true, settled: false });

    // Tens settles first (shorter delay in animation), then units
    // animation is 1.3s + delay; add small buffer
    const tensSettle  = 1300 + 0;    // delay 0ms
    const unitsSettle = 1300 + 120;  // delay 120ms

    setTimeout(() => {
      setTens((prev) => ({ ...prev, rolling: false, settled: true }));
    }, tensSettle);

    setTimeout(() => {
      setUnits((prev) => ({ ...prev, rolling: false, settled: true }));
      setPhase('done');
    }, unitsSettle);
  }

  const total     = tens.value === 0 && units.value === 0 ? 100 : tens.value * 10 + units.value;
  const isSuccess = phase === 'done' && total <= pendingRoll.goodThreshold;

  return (
    <div className="px-4 pt-3 pb-3 bg-stone-900 border-t border-stone-800">
      {/* Skill context line */}
      <p className="text-xs text-center text-stone-500 mb-4">
        <span className="text-amber-400 font-medium">{pendingRoll.skillName}</span>
        {' — кинь ≤ '}
        <span className="text-amber-300 font-mono font-semibold">{pendingRoll.goodThreshold}</span>
        {pendingRoll.context && (
          <span className="text-stone-600">{' · '}{pendingRoll.context}</span>
        )}
      </p>

      {/* Dice + result row */}
      <div className="flex items-center justify-center gap-2">
        <D10Die die={tens} label="десятки" delay={0} />

        <span className="text-stone-700 text-xl pb-5 select-none">+</span>

        <D10Die die={units} label="одиниці" delay={120} />

        {/* Result die */}
        {phase === 'done' && (
          <>
            <span className="text-stone-700 text-xl pb-5 select-none">=</span>
            <div className="flex flex-col items-center gap-3">
              <div
                className={[
                  'w-16 h-16 rounded-xl border-2 flex items-center justify-center',
                  isSuccess
                    ? 'bg-green-900/40 border-green-600'
                    : 'bg-red-900/30 border-red-700',
                ].join(' ')}
                style={{
                  animation: 'dice-reveal 0.4s ease-out forwards, dice-result-glow 0.8s ease-out forwards',
                  '--glow-color': isSuccess ? 'rgba(34,197,94,0.4)' : 'rgba(220,38,38,0.35)',
                } as React.CSSProperties}
              >
                <span
                  className={`font-mono text-2xl font-bold ${isSuccess ? 'text-green-300' : 'text-red-400'}`}
                >
                  {total}
                </span>
              </div>
              <span
                className={`text-[10px] uppercase tracking-wider font-semibold ${isSuccess ? 'text-green-500' : 'text-red-500'}`}
              >
                {isSuccess ? 'успіх' : 'провал'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Action button */}
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
          <span className="text-xs text-stone-600 tracking-widest animate-pulse">
            котяться...
          </span>
        )}
        {phase === 'done' && (
          <button
            onClick={() => onResult(total)}
            className={[
              'px-6 py-2 rounded-xl text-sm font-medium text-white border transition-colors',
              isSuccess
                ? 'bg-green-800 hover:bg-green-700 active:bg-green-900 border-green-600/50'
                : 'bg-red-900 hover:bg-red-800 active:bg-red-950 border-red-700/50',
            ].join(' ')}
          >
            {isSuccess ? '✓ Успіх' : '✗ Провал'} — надіслати {total}
          </button>
        )}
      </div>
    </div>
  );
}
