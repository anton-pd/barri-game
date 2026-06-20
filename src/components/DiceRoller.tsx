'use client';

import { useState, useEffect, useRef } from 'react';
import type { WorldState } from '@/types';
import { track } from '@/lib/analytics';

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

  function roll() {
    if (phase !== 'idle') return;

    // Result determined before animation starts
    const tens  = Math.floor(Math.random() * 10);
    const units = Math.floor(Math.random() * 10);
    setFinalTens(tens);
    setFinalUnits(units);

    // Reduced motion (ANT-103): skip the slot-machine flicker, show the result instantly.
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setTensDisplay(tens);
      setUnitsDisplay(units);
      setPhase('done');
      return;
    }

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
    <div className="dice-roller" role="group" aria-label="Активний кидок d100">
      <div className="dice-roller__brief">
        <span className="dice-roller__stamp">D100</span>
        <span className="dice-roller__skill">{pendingRoll.skillName}</span>
        <span className="dice-roller__target">≤ {pendingRoll.goodThreshold}</span>
        {pendingRoll.context && (
          <span className="dice-roller__context">{pendingRoll.context}</span>
        )}
      </div>

      <div className="dice-roller__reels">
        <div className="dice-roller__slot">
          <div className={`dice-roller__die dice-roller__die--${phase}`}>
            <span>
              {phase === 'idle' ? '–' : (tensDisplay * 10).toString().padStart(2, '0')}
            </span>
          </div>
          <span className="dice-roller__die-label">десятки</span>
        </div>

        <span className="dice-roller__operator">+</span>

        <div className="dice-roller__slot">
          <div className={`dice-roller__die dice-roller__die--${phase}`}>
            <span>{phase === 'idle' ? '–' : unitsDisplay}</span>
          </div>
          <span className="dice-roller__die-label">одиниці</span>
        </div>

        {phase === 'done' && (
          <>
            <span className="dice-roller__operator">=</span>
            <div className="dice-roller__slot">
              <div className={`dice-roller__result dice-roller__result--${isSuccess ? 'success' : 'fail'}`}>
                <span>{total}</span>
              </div>
              <span className={`dice-roller__outcome dice-roller__outcome--${isSuccess ? 'success' : 'fail'}`}>
                {isSuccess ? 'успіх' : 'провал'}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="dice-roller__actions">
        {phase === 'idle' && (
          <button
            type="button"
            onClick={roll}
            className="dice-roller__button dice-roller__button--primary"
          >
            Кинути d100
          </button>
        )}
        {phase === 'rolling' && (
          <span className="dice-roller__rolling">котяться...</span>
        )}
        {phase === 'done' && (
          <button
            type="button"
            onClick={() => {
              track('dice_roll', {
                skill: pendingRoll.skillName,
                value: pendingRoll.skillValue,
                threshold: pendingRoll.goodThreshold,
                roll: total,
                success: isSuccess,
              });
              onResult(total);
            }}
            className={`dice-roller__button dice-roller__button--${isSuccess ? 'success' : 'fail'}`}
          >
            {isSuccess ? 'Успіх' : 'Провал'} — надіслати {total}
          </button>
        )}
      </div>
    </div>
  );
}
