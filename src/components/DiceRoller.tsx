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
    <div className="chat-dice-roller">
      <div className="chat-dice-head">
        <div>
          <p className="chat-dice-kicker">Skill check</p>
          <p className="chat-dice-copy">
            <span className="chat-dice-skill">{pendingRoll.skillName}</span>
            {pendingRoll.context && (
              <span className="chat-dice-context">{' · '}{pendingRoll.context}</span>
            )}
          </p>
        </div>
        <div className="chat-dice-target">
          <span className="chat-dice-target-label">Ціль</span>
          <strong>≤ {pendingRoll.goodThreshold}</strong>
        </div>
      </div>

      <div className="chat-dice-row">
        <div className="chat-dice-col">
          <div className={`chat-die ${phase === 'rolling' ? 'is-rolling' : phase === 'done' ? 'is-done' : ''}`}>
            <span>
              {phase === 'idle' ? '–' : (tensDisplay * 10).toString().padStart(2, '0')}
            </span>
          </div>
          <span className="chat-die-label">десятки</span>
        </div>

        <span className="chat-dice-operator">+</span>

        <div className="chat-dice-col">
          <div className={`chat-die ${phase === 'rolling' ? 'is-rolling' : phase === 'done' ? 'is-done' : ''}`}>
            <span>
              {phase === 'idle' ? '–' : unitsDisplay}
            </span>
          </div>
          <span className="chat-die-label">одиниці</span>
        </div>

        {/* Result */}
        {phase === 'done' && (
          <>
            <span className="chat-dice-operator">=</span>
            <div className="chat-dice-col">
              <div className={`chat-die chat-die--result ${isSuccess ? 'is-success' : 'is-fail'}`}>
                <span>
                  {total}
                </span>
              </div>
              <span className={`chat-die-label ${isSuccess ? 'is-success' : 'is-fail'}`}>
                {isSuccess ? 'успіх' : 'провал'}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="chat-dice-action">
        {phase === 'idle' && (
          <button
            onClick={roll}
            className="chat-primary-btn"
          >
            🎲 Кинути d100
          </button>
        )}
        {phase === 'rolling' && (
          <span className="chat-dice-rolling">котяться...</span>
        )}
        {phase === 'done' && (
          <button
            onClick={() => onResult(total)}
            className={`chat-primary-btn ${isSuccess ? 'is-success' : 'is-fail'}`}
          >
            {isSuccess ? '✓ Успіх' : '✗ Провал'} — підтвердити {total}
          </button>
        )}
      </div>
    </div>
  );
}
