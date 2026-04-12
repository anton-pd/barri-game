'use client';

import { useState, useEffect } from 'react';
import type { GameSession, Scenario, Player } from '@/types';
import { ROLE_PRESETS, makePlayer, type RolePreset } from '@/lib/roles';

interface DraftPlayer {
  name: string;
  preset: RolePreset | null;
}

const emptyDraft = (): DraftPlayer => ({ name: '', preset: null });

export default function SessionList() {
  const [sessions, setSessions] = useState<(GameSession & { last_message?: string })[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [showNewGame, setShowNewGame] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [sessionName, setSessionName] = useState('');
  const [drafts, setDrafts] = useState<DraftPlayer[]>([emptyDraft()]);
  const [pickingRoleFor, setPickingRoleFor] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/sessions').then((r) => r.json()),
      fetch('/api/scenarios').then((r) => r.json()),
    ]).then(([s, sc]) => {
      setSessions(s);
      setScenarios(sc);
      setLoading(false);
    });
  }, []);

  function addDraft() {
    if (drafts.length < 4) setDrafts((prev) => [...prev, emptyDraft()]);
  }

  function removeDraft(idx: number) {
    if (drafts.length > 1) setDrafts((prev) => prev.filter((_, i) => i !== idx));
  }

  function setDraftName(idx: number, name: string) {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, name } : d)));
  }

  function setDraftPreset(idx: number, preset: RolePreset) {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, preset } : d)));
    setPickingRoleFor(null);
  }

  const canCreate =
    !isCreating &&
    !!sessionName.trim() &&
    drafts.every((d) => d.name.trim() && d.preset !== null);

  async function createSession() {
    if (!canCreate || !selectedScenario) return;
    setIsCreating(true);

    const players: Player[] = drafts.map((d) => makePlayer(d.name.trim(), d.preset!));

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: selectedScenario.id, name: sessionName, players }),
      });
      if (!res.ok) throw new Error('Failed');
      const session = await res.json();
      window.location.href = `/session/${session.id}`;
    } catch {
      setIsCreating(false);
    }
  }

  async function deleteSession(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Видалити цю сесію?')) return;
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  function closeModal() {
    setShowNewGame(false);
    setSelectedScenario(null);
    setSessionName('');
    setDrafts([emptyDraft()]);
    setPickingRoleFor(null);
  }

  const difficultyLabel = (d: string) => {
    if (d === 'beginner') return { text: 'Початківець', color: 'text-green-400' };
    if (d === 'intermediate') return { text: 'Середній', color: 'text-yellow-400' };
    return { text: 'Складний', color: 'text-red-400' };
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-amber-500 mb-1">Call of Cthulhu</h1>
          <p className="text-stone-500 text-sm">AI Keeper — Поклик Ктулху</p>
        </div>

        <button
          onClick={() => setShowNewGame(true)}
          className="w-full py-3 mb-6 bg-amber-800 hover:bg-amber-700 rounded-xl text-amber-100 font-semibold transition-colors"
        >
          + Нова гра
        </button>

        {loading ? (
          <p className="text-center text-stone-600">Завантаження...</p>
        ) : sessions.length === 0 ? (
          <div className="text-center text-stone-600 py-8">
            <p className="text-4xl mb-3">🐙</p>
            <p>Немає активних сесій. Почніть нову гру!</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xs text-stone-500 uppercase tracking-wider mb-2">Активні сесії</h2>
            {sessions.map((s) => (
              <a
                key={s.id}
                href={`/session/${s.id}`}
                className="block bg-stone-900 hover:bg-stone-800 border border-stone-800 hover:border-stone-700 rounded-xl p-4 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-stone-200 truncate">{s.name}</h3>
                    <p className="text-xs text-stone-500 mb-2">
                      {s.scenario_id} · Акт {s.world_state?.act || 1} ·{' '}
                      {new Date(s.updated_at).toLocaleDateString('uk-UA')}
                    </p>
                    {s.last_message && (
                      <p className="text-xs text-stone-600 truncate italic">«{s.last_message}»</p>
                    )}
                    <div className="flex gap-1 mt-2">
                      {(s.players as Player[]).map((p, i) => (
                        <span key={i} className="text-xs bg-stone-800 text-stone-400 rounded px-1.5 py-0.5">
                          {p.name} · {p.role}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-3 items-start">
                    <button
                      onClick={(e) => deleteSession(s.id, e)}
                      className="text-stone-700 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                    <span className="text-amber-600 text-sm">→</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showNewGame && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-stone-200">Нова гра</h2>
                <button onClick={closeModal} className="text-stone-500 hover:text-stone-300 text-xl">✕</button>
              </div>

              {/* Role picker overlay */}
              {pickingRoleFor !== null ? (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setPickingRoleFor(null)} className="text-amber-600 text-sm">← Назад</button>
                    <span className="text-sm text-stone-400">Оберіть клас для {drafts[pickingRoleFor].name || `Гравця ${pickingRoleFor + 1}`}</span>
                  </div>
                  <div className="space-y-2">
                    {ROLE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => setDraftPreset(pickingRoleFor, preset)}
                        className="w-full text-left bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-xl p-3 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-stone-200">{preset.name}</span>
                          <div className="flex gap-2 text-xs">
                            <span className="text-red-400">HP {preset.hp}</span>
                            <span className="text-purple-400">SAN {preset.sanity}</span>
                          </div>
                        </div>
                        <p className="text-xs text-stone-500 mb-2">{preset.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(preset.skills).map(([skill, val]) => (
                            <span key={skill} className="text-xs bg-stone-700 text-stone-400 rounded px-1.5 py-0.5">
                              {skill} {val}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : !selectedScenario ? (
                /* Scenario picker */
                <div>
                  <p className="text-sm text-stone-400 mb-3">Оберіть сценарій:</p>
                  <div className="space-y-2">
                    {scenarios.map((sc) => {
                      const diff = difficultyLabel(sc.difficulty);
                      return (
                        <button
                          key={sc.id}
                          onClick={() => setSelectedScenario(sc)}
                          className="w-full text-left bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-xl p-4 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-stone-200">{sc.titleUk}</h3>
                              <p className="text-xs text-stone-500">{sc.era}</p>
                            </div>
                            <span className={`text-xs ${diff.color}`}>{diff.text}</span>
                          </div>
                          <p className="text-xs text-stone-500 mt-2">{sc.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Player setup */
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-stone-400">
                    <button onClick={() => setSelectedScenario(null)} className="text-amber-600">←</button>
                    <span>{selectedScenario.titleUk}</span>
                  </div>

                  <div>
                    <label className="text-xs text-stone-500 block mb-1">Назва сесії</label>
                    <input
                      type="text"
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      placeholder="Напр: Ніч у Бостоні"
                      className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-700"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-stone-500 block mb-2">Гравці (1–4)</label>
                    <div className="space-y-3">
                      {drafts.map((d, i) => (
                        <div key={i} className="bg-stone-800 border border-stone-700 rounded-xl p-3">
                          <div className="flex gap-2 items-center mb-2">
                            <input
                              type="text"
                              value={d.name}
                              onChange={(e) => setDraftName(i, e.target.value)}
                              placeholder={`Ім'я гравця ${i + 1}`}
                              className="flex-1 bg-stone-700 border border-stone-600 rounded-lg px-2 py-1.5 text-sm text-stone-200 placeholder-stone-500 focus:outline-none"
                            />
                            {drafts.length > 1 && (
                              <button
                                onClick={() => removeDraft(i)}
                                className="text-stone-600 hover:text-red-500 text-sm px-1"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          {d.preset ? (
                            <button
                              onClick={() => setPickingRoleFor(i)}
                              className="w-full text-left bg-stone-700 hover:bg-stone-600 rounded-lg px-3 py-2 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-stone-200">{d.preset.name}</span>
                                <div className="flex gap-2 text-xs">
                                  <span className="text-red-400">HP {d.preset.hp}</span>
                                  <span className="text-purple-400">SAN {d.preset.sanity}</span>
                                  <span className="text-stone-500">змінити →</span>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {Object.entries(d.preset.skills).map(([skill, val]) => (
                                  <span key={skill} className="text-xs text-stone-500">
                                    {skill} {val}
                                  </span>
                                ))}
                              </div>
                            </button>
                          ) : (
                            <button
                              onClick={() => setPickingRoleFor(i)}
                              className="w-full py-2 text-sm text-amber-700 hover:text-amber-500 border border-dashed border-stone-600 rounded-lg transition-colors"
                            >
                              + Обрати клас
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {drafts.length < 4 && (
                      <button
                        onClick={addDraft}
                        className="text-xs text-amber-700 hover:text-amber-500 mt-2"
                      >
                        + Додати гравця
                      </button>
                    )}
                  </div>

                  <button
                    onClick={createSession}
                    disabled={!canCreate}
                    className="w-full py-2.5 bg-amber-800 hover:bg-amber-700 disabled:bg-stone-700 disabled:cursor-not-allowed rounded-xl text-amber-100 font-semibold transition-colors"
                  >
                    {isCreating ? 'Створення...' : 'Почати гру'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
