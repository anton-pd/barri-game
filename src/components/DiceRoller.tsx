'use client';

import { useEffect, useRef, useState } from 'react';
import type { WorldState } from '@/types';

interface DiceRollerProps {
  pendingRoll: NonNullable<WorldState['pendingRollResult']>;
  onResult: (result: number) => void;
}

export default function DiceRoller({ pendingRoll, onResult }: DiceRollerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boxRef       = useRef<any>(null);
  const [ready,  setReady]  = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);

  // Reset state when a new roll is requested
  useEffect(() => {
    setResult(null);
    setRolling(false);
  }, [pendingRoll.skillName, pendingRoll.goodThreshold]);

  // Init dice-box once container is mounted
  useEffect(() => {
    if (!containerRef.current) return;
    let box: typeof boxRef.current;

    import('@3d-dice/dice-box').then(({ default: DiceBox }) => {
      box = new DiceBox({
        assetPath: '/assets/dice-box/',
        container: containerRef.current!,
        id: 'dice-box-canvas',
        scale: 6,
        gravity: 2,
        mass: 1,
        friction: 0.8,
        restitution: 0.5,
        offscreen: true,
        enableShadows: true,
        lightIntensity: 1,
        theme: 'default',
        themeColor: '#b45309', // amber-700 tint for CoC mood
      });

      box.init().then(() => {
        boxRef.current = box;
        setReady(true);

        // Result callback — fires after all dice settle
        box.onRollComplete = (results: any) => {
          // results.rolls[0].rolls = array of individual die values (1-10 each)
          const [d1, d2] = results.rolls[0].rolls as number[];
          const tens  = (d1 % 10) * 10;   // 1→10, ..., 9→90, 10→00
          const units = d2 % 10;           // 1→1,  ..., 9→9,  10→0
          const total = tens === 0 && units === 0 ? 100 : tens + units;
          setResult(total);
          setRolling(false);
        };
      });
    });

    return () => {
      box?.clear?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function roll() {
    if (!boxRef.current || !ready || rolling) return;
    setResult(null);
    setRolling(true);
    boxRef.current.roll('2d10');
  }

  const isSuccess = result !== null && result <= pendingRoll.goodThreshold;

  return (
    <div className="bg-stone-900 border-t border-stone-800">
      {/* Context */}
      <div className="px-4 pt-3 text-xs text-center text-stone-500">
        <span className="text-amber-400 font-medium">{pendingRoll.skillName}</span>
        {' — кинь ≤ '}
        <span className="text-amber-300 font-mono font-semibold">{pendingRoll.goodThreshold}</span>
        {pendingRoll.context && (
          <span className="text-stone-600">{' · '}{pendingRoll.context}</span>
        )}
      </div>

      {/* Dice canvas */}
      <div
        ref={containerRef}
        className="relative w-full"
        style={{ height: 220 }}
      />

      {/* Action row */}
      <div className="flex items-center justify-center gap-3 px-4 pb-3">
        {!ready && (
          <span className="text-xs text-stone-600 animate-pulse">завантаження...</span>
        )}

        {ready && result === null && (
          <button
            onClick={roll}
            disabled={rolling}
            className="px-6 py-2 bg-amber-900 hover:bg-amber-800 active:bg-amber-950 disabled:opacity-50 rounded-xl text-sm font-medium text-amber-100 border border-amber-700/50 transition-colors"
          >
            {rolling ? 'котяться...' : '🎲 Кинути'}
          </button>
        )}

        {ready && result !== null && (
          <>
            <span className={`font-mono text-xl font-bold ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
              {result}
            </span>
            <span className={`text-xs uppercase tracking-wider ${isSuccess ? 'text-green-500' : 'text-red-500'}`}>
              {isSuccess ? '✓ успіх' : '✗ провал'}
            </span>
            <button
              onClick={() => onResult(result)}
              className={[
                'px-5 py-1.5 rounded-xl text-sm font-medium text-white border transition-colors',
                isSuccess
                  ? 'bg-green-800 hover:bg-green-700 border-green-600/50'
                  : 'bg-red-900 hover:bg-red-800 border-red-700/50',
              ].join(' ')}
            >
              надіслати
            </button>
          </>
        )}
      </div>
    </div>
  );
}
