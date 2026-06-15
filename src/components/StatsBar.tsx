'use client';

import { useState } from 'react';
import type { Player } from '@/types';
import { resolvePlayerStats } from '@/lib/statUtils';
import Icon from './Icon';

interface StatsBarProps {
  players: Player[];
  activePlayer?: number;
  onSelectPlayer?: (idx: number) => void;
  rulesetId?: string;
  onUseItem?: (playerIdx: number, itemId: string, itemName: string) => void;
  readOnly?: boolean;
}

const STAT_TONE: Record<string, 'blood' | 'bruise' | 'amber' | 'smoke'> = {
  hp: 'blood',
  sanity: 'bruise',
  luck: 'amber',
};

export default function StatsBar({
  players,
  activePlayer = 0,
  onSelectPlayer,
  rulesetId = 'coc_7e',
  onUseItem,
  readOnly = false,
}: StatsBarProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="stats-bar">
      <div className="stats-bar__row">
        {players.map((p, idx) => {
          const stats = resolvePlayerStats(p, rulesetId);
          const isOpen = expanded === idx;
          const isActive = activePlayer === idx;
          const inventory = p.inventory ?? [];
          const usableInventory = inventory.filter((it) => !it.broken && it.uses !== 0);

          return (
            <div
              key={idx}
              className={`stats-card${isActive ? ' stats-card--active' : ''}${isOpen ? ' stats-card--open' : ''}`}
            >
              <button
                type="button"
                onClick={() => {
                  onSelectPlayer?.(idx);
                  setExpanded(isOpen ? null : idx);
                }}
                className="stats-card__header"
                title={isOpen ? 'Згорнути' : 'Розгорнути'}
                aria-label={`${p.name}: ${isOpen ? 'згорнути' : 'розгорнути'} характеристики та інвентар`}
                aria-expanded={isOpen}
              >
                <span className="stats-card__identity">
                  <span className="stats-card__name">{p.name}</span>
                  {p.role && <span className="stats-card__role">· {p.role}</span>}
                </span>
                <span className="stats-card__meta">
                  {/* ANT-139: on mobile the full bar block is hidden until the
                      card opens — these inline numbers keep stats glanceable */}
                  <span className="stats-card__compact" aria-hidden>
                    {stats.filter((s) => s.hasMax).map((s) => (
                      <span
                        key={s.id}
                        className={`stats-card__compact-stat stats-card__compact-stat--${STAT_TONE[s.id] ?? 'smoke'}`}
                      >
                        {s.value}
                      </span>
                    ))}
                  </span>
                  {usableInventory.length > 0 && (
                    <span className="stats-card__inv-count" title="Предмети">
                      <Icon name="inventory" /> {usableInventory.length}
                    </span>
                  )}
                  <span className={`stats-card__chevron${isOpen ? ' stats-card__chevron--open' : ''}`} aria-hidden>
                    <Icon name="chevron-down" />
                  </span>
                </span>
              </button>

              <div className="stats-card__bars">
                {stats.map((s) => {
                  const max = s.hasMax ? (s.max ?? 0) : 0;
                  const pct = s.hasMax && max > 0 ? Math.max(0, Math.min(1, s.value / max)) : 1;
                  const tone = STAT_TONE[s.id] ?? 'smoke';
                  return (
                    <div key={s.id} className={`stat-row stat-row--${tone}`}>
                      <span className="stat-row__label">{s.label}</span>
                      {s.hasMax ? (
                        <div className="stat-row__track">
                          <div className="stat-row__fill" style={{ width: `${pct * 100}%` }} />
                        </div>
                      ) : (
                        <div className="stat-row__track stat-row__track--ghost" />
                      )}
                      <span className="stat-row__value">
                        {s.hasMax && s.max !== null ? `${s.value}/${s.max}` : s.value}
                      </span>
                    </div>
                  );
                })}
              </div>

              {isOpen && (
                <>
                  {p.background && (
                    <div className="stats-card__section">
                      <p className="stats-card__bio">{p.background}</p>
                    </div>
                  )}
                  {p.skills && Object.keys(p.skills).length > 0 && (
                    <div className="stats-card__section">
                      <p className="stats-card__section-label">Навички</p>
                      <div className="stats-card__skills">
                        {Object.entries(p.skills).map(([skill, val]) => (
                          <div key={skill} className="stats-card__skill">
                            <span className="stats-card__skill-name">{skill}</span>
                            <span className="stats-card__skill-value">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {inventory.length > 0 && (
                    <div className="stats-card__section">
                      <p className="stats-card__section-label">Інвентар</p>
                      <div className="stats-card__inv-list">
                        {inventory.map((item) => {
                          const exhausted = item.uses === 0;
                          const broken = item.broken;
                          const equipped = item.equipped;
                          const dimmed = exhausted || broken;
                          const stateClass = broken
                            ? ' inv-item--broken'
                            : exhausted
                              ? ' inv-item--spent'
                              : equipped
                                ? ' inv-item--equipped'
                                : '';
                          return (
                            <div key={item.id} className={`inv-item${stateClass}`}>
                              <div className="inv-item__main">
                                <span className="inv-item__title">
                                  {equipped && <span className="inv-item__icon" aria-hidden><Icon name="equipped" /></span>}
                                  {broken && <span className="inv-item__icon" aria-hidden><Icon name="broken" /></span>}
                                  <span className="inv-item__name">{item.name}</span>
                                  <span className="inv-item__uses">
                                    {broken ? 'зламаний' : item.uses === -1 ? '∞' : `×${item.uses}`}
                                  </span>
                                </span>
                                {item.description && (
                                  <p className="inv-item__desc">{item.description}</p>
                                )}
                              </div>
                              {!dimmed && !readOnly && onUseItem && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUseItem(idx, item.id, item.name);
                                    setExpanded(null);
                                  }}
                                  className="inv-item__use"
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
