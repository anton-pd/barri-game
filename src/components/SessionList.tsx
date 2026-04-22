'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { GameSession, Scenario, Player, WorldState } from '@/types';
import { getRolesForScenario, makePlayer, type RolePreset } from '@/lib/roles';
import { version as appVersion } from '../../package.json';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DraftPlayer {
  name: string;
  preset: RolePreset | null;
}

const emptyDraft = (): DraftPlayer => ({ name: '', preset: null });

type SessionListEntry = GameSession & {
  last_message?: string;
  latest_summary?: string;
  message_count?: number;
};

type RawSession = Partial<GameSession> & {
  players?: GameSession['players'] | string;
  world_state?: GameSession['world_state'] | string;
  last_message?: string;
  latest_summary?: string;
  message_count?: number;
};

interface UserInfo {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function stripMessagePreview(content?: string) {
  if (!content) return '';
  return content
    .replace(/\[NPC:[^\]]+\]([\s\S]*?)\[\/NPC\]/g, '$1')
    .replace(/\[IMAGE:[^\]]+\]/g, '')
    .replace(/\[(?:DELTA|ITEM|USE_ITEM|REMOVE_ITEM|EQUIP|BREAK_ITEM|LOCATION|NEW_LOCATION|SET_PENDING_ROLL|CLEAR_PENDING_ROLL|RANDOM_EVENT):[^\]]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSession(session: RawSession): SessionListEntry {
  let players = session.players;
  if (typeof players === 'string') {
    try { players = JSON.parse(players); } catch { players = []; }
  }
  let worldState = session.world_state;
  if (typeof worldState === 'string') {
    try { worldState = JSON.parse(worldState) as GameSession['world_state']; } catch { worldState = undefined; }
  }
  return {
    ...(session as GameSession),
    players: (players ?? []) as Player[],
    world_state: (worldState ?? {}) as GameSession['world_state'],
    status: (session.status ?? 'active') as GameSession['status'],
    last_message: stripMessagePreview(session.last_message),
    latest_summary: session.latest_summary,
    message_count: session.message_count,
  };
}

const READ_ONLY_CACHE_KEY = 'barri.readOnlySessions';

function loadCachedReadOnlySessions(): SessionListEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(READ_ONLY_CACHE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as SessionListEntry[])
      .map((s) => normalizeSession(s))
      .filter((s) => s.status === 'completed' || s.status === 'paused');
  } catch { return []; }
}

function removeCachedSession(id: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.sessionStorage.getItem(READ_ONLY_CACHE_KEY);
    if (!raw) return;
    const next = (JSON.parse(raw) as SessionListEntry[]).filter((s) => s.id !== id);
    window.sessionStorage.setItem(READ_ONLY_CACHE_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

function mergeSessions(primary: SessionListEntry[], fallback: SessionListEntry[]) {
  const byId = new Map<string, SessionListEntry>();
  for (const s of fallback) byId.set(s.id, s);
  for (const s of primary)  byId.set(s.id, s);
  return [...byId.values()].sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

/** Extract a thumbnail URL from sessionImages (most recently inserted value). */
function getSessionThumbnail(worldState: WorldState | undefined): string | null {
  const imgs = worldState?.sessionImages;
  if (!imgs) return null;
  const vals = Object.values(imgs);
  return vals.length > 0 ? vals[vals.length - 1] : null;
}

/** Get stamp label + CSS modifier for session status. */
function statusStamp(s: SessionListEntry) {
  if (s.status === 'completed') return { label: 'Закрито',    mod: 'completed' };
  if (s.status === 'paused')    return { label: 'На паузі',   mod: 'paused'    };
  return s.campaign_id
    ? { label: 'Кампанія', mod: 'active' }
    : { label: 'Активна',  mod: 'active' };
}

const sessionLabelsUk = ['перша','друга','третя','четверта','п'ята','шоста','сьома','восьма','дев'ята','десята'];

function difficultyMeta(d: string) {
  if (d === 'beginner')     return { label: 'Початківець', mod: 'beginner'     };
  if (d === 'intermediate') return { label: 'Середній',    mod: 'intermediate' };
  return                           { label: 'Складний',    mod: 'advanced'     };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SessionList() {
  const router = useRouter();

  const [sessions,  setSessions]  = useState<SessionListEntry[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [user,      setUser]      = useState<UserInfo | null>(null);
  const [loading,   setLoading]   = useState(true);

  // New-session modal
  const [selectedScenario,  setSelectedScenario]  = useState<Scenario | null>(null);
  const [sessionName,       setSessionName]        = useState('');
  const [drafts,            setDrafts]             = useState<DraftPlayer[]>([emptyDraft()]);
  const [pickingRoleFor,    setPickingRoleFor]      = useState<number | null>(null);
  const [language,          setLanguage]            = useState<'uk' | 'en'>('uk');
  const [isCreating,        setIsCreating]          = useState(false);

  // ── Load data ────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [sessRes, scRes, meRes] = await Promise.all([
          fetch('/api/sessions'),
          fetch('/api/scenarios'),
          fetch('/api/auth/me'),
        ]);
        if (sessRes.status === 401) { window.location.href = '/auth/login'; return; }
        if (!sessRes.ok || !scRes.ok) { setLoading(false); return; }

        const [rawSessions, rawScenarios, meData] = await Promise.all([
          sessRes.json(),
          scRes.json(),
          meRes.ok ? meRes.json() : null,
        ]);

        const parsed  = (Array.isArray(rawSessions) ? rawSessions : []).map((s) => normalizeSession(s as RawSession));
        const cached  = loadCachedReadOnlySessions();
        setSessions(mergeSessions(parsed, cached));
        setScenarios(Array.isArray(rawScenarios) ? rawScenarios : []);
        setUser(meData ?? null);
      } catch (err) {
        console.error('Network error loading data', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Auth actions ─────────────────────────────────────────────────────────────

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/auth/login');
    router.refresh();
  }

  // ── New-session helpers ──────────────────────────────────────────────────────

  const openModal = useCallback((sc: Scenario) => {
    setSelectedScenario(sc);
    setSessionName('');
    setDrafts([emptyDraft()]);
    setPickingRoleFor(null);
    setLanguage('uk');
  }, []);

  function closeModal() {
    setSelectedScenario(null);
    setPickingRoleFor(null);
  }

  function addDraft() {
    if (drafts.length < 4) setDrafts((p) => [...p, emptyDraft()]);
  }

  function removeDraft(idx: number) {
    if (drafts.length > 1) setDrafts((p) => p.filter((_, i) => i !== idx));
  }

  function setDraftName(idx: number, name: string) {
    setDrafts((p) => p.map((d, i) => (i === idx ? { ...d, name } : d)));
  }

  function setDraftPreset(idx: number, preset: RolePreset) {
    setDrafts((p) => p.map((d, i) => (i === idx ? { ...d, preset } : d)));
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
        body: JSON.stringify({ scenarioId: selectedScenario.id, name: sessionName, players, language }),
      });
      if (!res.ok) throw new Error('Failed');
      const session = await res.json() as GameSession;
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
    setSessions((p) => p.filter((s) => s.id !== id));
    removeCachedSession(id);
  }

  // ── Derived state ─────────────────────────────────────────────────────────────

  const activeSessions    = sessions.filter((s) => s.status === 'active');
  const pausedSessions    = sessions.filter((s) => s.status === 'paused');
  const completedSessions = sessions.filter((s) => s.status === 'completed');
  const totalMessages     = sessions.reduce((acc, s) => acc + (s.message_count ?? 0), 0);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="sessions-page">

      {/* ── Topbar ── */}
      <header className="topbar">
        <Link href="/" className="mark" style={{ textDecoration: 'none' }}>
          <span className="seal">B</span>
          <span className="wordmark">Barri</span>
        </Link>

        <div className="topbar-right">
          <span style={{
            fontFamily: 'var(--font-typewriter)',
            fontSize: '10px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--paper-3)',
          }}>
            v{appVersion}
          </span>

          {user && (
            <div className="sessions-authbar">
              {user.role === 'admin' && (
                <Link href="/admin" className="sessions-authbar-admin">Admin</Link>
              )}
              <span className="sessions-authbar-email">{user.email}</span>
              <button className="sessions-authbar-logout" onClick={handleLogout}>
                Вийти
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Bureau stats (Tier 2) ── */}
      {!loading && sessions.length > 0 && (
        <div className="bureau-stats">
          <div className="bureau-stat">
            <span className="bureau-stat-value">{activeSessions.length}</span>
            <span className="bureau-stat-label">Активних</span>
          </div>
          {pausedSessions.length > 0 && (
            <div className="bureau-stat">
              <span className="bureau-stat-value">{pausedSessions.length}</span>
              <span className="bureau-stat-label">На паузі</span>
            </div>
          )}
          <div className="bureau-stat">
            <span className="bureau-stat-value">{completedSessions.length}</span>
            <span className="bureau-stat-label">Завершено</span>
          </div>
          <div className="bureau-stat">
            <span className="bureau-stat-value">{totalMessages}</span>
            <span className="bureau-stat-label">Повідомлень</span>
          </div>
        </div>
      )}

      {/* ── Open Investigations ── */}
      <div className="sessions-section">
        <div className="section-divider">
          <span className="section-divider-title">Відкриті справи</span>
        </div>

        {loading ? (
          <div className="sessions-loading-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="sessions-loading-card" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          /* Empty state (Tier 2) */
          <div className="sessions-empty">
            <span className="sessions-empty-glyph">ꝏ</span>
            <h3>Жодних справ не відкрито</h3>
            <p>Архів порожній. Оберіть справу нижче, щоб розпочати розслідування.</p>
          </div>
        ) : (
          <div className="session-cards-grid">
            {sessions.map((s) => {
              const stamp     = statusStamp(s);
              const thumbnail = getSessionThumbnail(s.world_state);
              const players   = s.players as Player[];
              const location  = s.world_state?.currentLocation;
              const campaignSession = s.campaign_id
                ? (sessionLabelsUk[(s.session_number || 1) - 1] ?? `${s.session_number}-та сесія`)
                : null;

              return (
                <Link
                  key={s.id}
                  href={`/session/${s.id}`}
                  className="session-card"
                >
                  {/* Thumbnail */}
                  <div className="session-card-thumb">
                    {thumbnail ? (
                      <img src={thumbnail} alt="" loading="lazy" />
                    ) : (
                      <div className="session-card-thumb-fallback">
                        <span className="session-card-thumb-glyph">ꝏ</span>
                      </div>
                    )}
                    <div className={`session-stamp session-stamp--${stamp.mod}`}>
                      {stamp.label}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="session-card-body">
                    <div className="session-card-name">{s.name}</div>

                    <div className="session-card-meta">
                      <span>{s.scenario_id}</span>
                      <span className="session-card-meta-dot">·</span>
                      <span>{formatDate(s.updated_at)}</span>
                      {campaignSession && (
                        <>
                          <span className="session-card-meta-dot">·</span>
                          <span>{campaignSession}</span>
                        </>
                      )}
                    </div>

                    {location && (
                      <div className="session-location">{location}</div>
                    )}

                    {/* Previously... (Tier 2) */}
                    {s.latest_summary && (
                      <div className="session-summary">
                        {s.latest_summary}
                      </div>
                    )}

                    {/* Players */}
                    {players.length > 0 && (
                      <div className="session-players">
                        {players.map((p, i) => (
                          <span key={i} className="session-player-chip">
                            {p.name}
                            {p.hp !== undefined && (
                              <> · HP&nbsp;{p.hp}&nbsp;·&nbsp;SAN&nbsp;{p.sanity}</>
                            )}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="session-card-footer">
                      <button
                        className="session-delete-btn"
                        onClick={(e) => deleteSession(s.id, e)}
                        title="Видалити сесію"
                      >
                        Видалити
                      </button>
                      <span className="session-enter-btn">
                        Увійти <span aria-hidden="true">→</span>
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Available Case Files (always visible, Tier 1) ── */}
      <div className="sessions-section">
        <div className="section-divider">
          <span className="section-divider-title">Доступні справи</span>
        </div>

        <div className="case-files-grid">
          {scenarios.map((sc) => {
            const diff = difficultyMeta(sc.difficulty);
            const isCampaign = sc.sessionConfig?.isCampaign;
            return (
              <div key={sc.id} className="case-file-card">
                <div>
                  <span className={`case-file-difficulty case-file-difficulty--${diff.mod}`}>
                    {diff.label}
                  </span>
                  <span className="case-file-badge">
                    {isCampaign ? '· кампанія' : '· one-shot'}
                  </span>
                </div>
                <div className="case-file-title">{sc.titleUk}</div>
                <div className="case-file-era">{sc.era}</div>
                <div className="case-file-desc">{sc.description}</div>
                <button
                  className="case-file-open-btn"
                  onClick={() => openModal(sc)}
                >
                  <span>Розпочати розслідування</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── New-session modal ── */}
      {selectedScenario && (
        <div className="nsm-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="nsm-sheet">
            {/* Drag handle (mobile) */}
            <div className="nsm-drag-handle">
              <div className="nsm-drag-bar" />
            </div>

            <div className="nsm-inner">
              {/* Header */}
              <div className="nsm-header">
                <div>
                  <div className="nsm-scenario-label">Справа</div>
                  <div className="nsm-scenario-title">{selectedScenario.titleUk}</div>
                </div>
                <button className="nsm-close" onClick={closeModal} aria-label="Закрити">✕</button>
              </div>

              {/* Role picker overlay */}
              {pickingRoleFor !== null ? (
                <div>
                  <div className="nsm-role-picker-back">
                    <button
                      className="nsm-role-picker-back-btn"
                      onClick={() => setPickingRoleFor(null)}
                    >
                      ← Назад
                    </button>
                    <span className="nsm-role-picker-for">
                      Клас для {drafts[pickingRoleFor].name || `Гравця ${pickingRoleFor + 1}`}
                    </span>
                  </div>
                  <div className="nsm-role-list">
                    {getRolesForScenario(selectedScenario).map((preset) => (
                      <button
                        key={preset.id}
                        className="nsm-role-option"
                        onClick={() => setDraftPreset(pickingRoleFor!, preset)}
                      >
                        <div className="nsm-role-option-header">
                          <span className="nsm-role-option-name">{preset.name}</span>
                          <div className="nsm-role-option-stats">
                            {preset.hp !== undefined && (
                              <span style={{ color: 'var(--blood-0)' }}>HP {preset.hp}</span>
                            )}
                            {preset.sanity !== undefined && (
                              <span style={{ color: 'var(--amber-2)' }}>SAN {preset.sanity}</span>
                            )}
                          </div>
                        </div>
                        <div className="nsm-role-option-desc">{preset.description}</div>
                        <div className="nsm-role-option-skills">
                          {Object.entries(preset.skills).map(([skill, val]) => (
                            <span key={skill} className="nsm-skill-tag">
                              {skill} {val}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Player setup form */
                <div className="nsm-form">
                  {/* Session name */}
                  <div className="nsm-field">
                    <label htmlFor="nsm-name">Назва справи</label>
                    <input
                      id="nsm-name"
                      type="text"
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      placeholder="Напр: Ніч у Бостоні"
                      autoComplete="off"
                    />
                  </div>

                  {/* Language */}
                  <div className="nsm-field">
                    <label>Мова гри</label>
                    <div className="nsm-lang-toggle">
                      {(['uk', 'en'] as const).map((lang) => (
                        <button
                          key={lang}
                          className={`nsm-lang-btn${language === lang ? ' nsm-lang-btn--active' : ''}`}
                          onClick={() => setLanguage(lang)}
                          type="button"
                        >
                          {lang === 'uk' ? '🇺🇦 Українська' : '🇬🇧 English'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Players */}
                  <div className="nsm-field">
                    <label>Гравці (1–4)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {drafts.map((d, i) => (
                        <div key={i} className="nsm-player-card">
                          <div className="nsm-player-row">
                            <input
                              type="text"
                              value={d.name}
                              onChange={(e) => setDraftName(i, e.target.value)}
                              placeholder={`Ім'я гравця ${i + 1}`}
                              autoComplete="off"
                            />
                            {drafts.length > 1 && (
                              <button
                                className="nsm-remove-btn"
                                onClick={() => removeDraft(i)}
                                type="button"
                                aria-label="Видалити гравця"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          {d.preset ? (
                            <button
                              className="nsm-role-selected"
                              onClick={() => setPickingRoleFor(i)}
                              type="button"
                            >
                              <span className="nsm-role-name">{d.preset.name}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="nsm-role-stats">
                                  {d.preset.hp !== undefined && (
                                    <span style={{ color: 'var(--blood-0)' }}>HP {d.preset.hp}</span>
                                  )}
                                  {d.preset.sanity !== undefined && (
                                    <span style={{ color: 'var(--amber-2)' }}>SAN {d.preset.sanity}</span>
                                  )}
                                </div>
                                <span className="nsm-role-change">змінити →</span>
                              </div>
                            </button>
                          ) : (
                            <button
                              className="nsm-role-btn"
                              onClick={() => setPickingRoleFor(i)}
                              type="button"
                            >
                              + Обрати клас
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {drafts.length < 4 && (
                      <button
                        className="nsm-add-player-btn"
                        onClick={addDraft}
                        type="button"
                        style={{ marginTop: '10px' }}
                      >
                        + Додати гравця
                      </button>
                    )}
                  </div>

                  {/* Submit */}
                  <button
                    className="nsm-submit"
                    onClick={createSession}
                    disabled={!canCreate}
                    type="button"
                  >
                    <span>{isCreating ? 'Відкриваємо справу...' : 'Відкрити справу'}</span>
                    {!isCreating && <span aria-hidden="true">→</span>}
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
