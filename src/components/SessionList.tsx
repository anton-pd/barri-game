'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { GameSession, Player, WorldState } from '@/types';
import type { ScenarioCatalogEntry } from '@/lib/scenarioCatalog';
import { getRolesForScenario, makePlayer, type RolePreset } from '@/lib/roles';
import { track } from '@/lib/analytics';
import { version as appVersion } from '../../package.json';
import { clearAllSessionCaches, loadUserSessionCache, writeUserSessionCache } from '@/lib/sessionCache';
import { classifySessionLoad, sessionCreateErrorCopy } from '@/lib/sessionRecovery';

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
  access_status?: 'pending' | 'approved' | 'blocked';
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

function loadCachedReadOnlySessions(userId: string): SessionListEntry[] {
  return loadUserSessionCache<SessionListEntry>(userId)
    .map((s) => normalizeSession(s))
    .filter((s) => s.status === 'completed' || s.status === 'paused');
}

function removeCachedSession(userId: string, id: string) {
  writeUserSessionCache(userId, loadUserSessionCache<SessionListEntry>(userId).filter((s) => s.id !== id));
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
function statusStamp(s: SessionListEntry, playedEvening = false) {
  // A finished evening of an still-active campaign is not a closed case —
  // it's a played evening belonging to the ongoing campaign.
  if (playedEvening)            return { label: 'Вечір зіграно', mod: 'active'    };
  if (s.status === 'completed') return { label: 'Закрито',    mod: 'completed' };
  if (s.status === 'paused')    return { label: 'На паузі',   mod: 'paused'    };
  return s.campaign_id
    ? { label: 'Кампанія', mod: 'active' }
    : { label: 'Активна',  mod: 'active' };
}

const sessionLabelsUk = ["перша","друга","третя","четверта","п'ята","шоста","сьома","восьма","дев'ята","десята"];

function difficultyMeta(d: string) {
  if (d === 'beginner')     return { label: 'Початківець', mod: 'beginner'     };
  if (d === 'intermediate') return { label: 'Середній',    mod: 'intermediate' };
  return                           { label: 'Складний',    mod: 'advanced'     };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── SessionCard sub-component ─────────────────────────────────────────────────

function SessionCard({
  s,
  onDelete,
  playedEvening = false,
  coverFallback,
  scenario,
}: {
  s: SessionListEntry;
  onDelete: (id: string, e: React.MouseEvent) => void;
  playedEvening?: boolean;
  coverFallback?: string;
  scenario?: ScenarioCatalogEntry;
}) {
  const [confirming, setConfirming] = useState(false);

  const stamp           = statusStamp(s, playedEvening);
  // Prefer a session-generated scene; fall back to the scenario cover so
  // freshly-created sessions never show the ∞ placeholder (ANT-99).
  const thumbnail       = getSessionThumbnail(s.world_state) || coverFallback || null;
  const isClosed        = s.status === 'completed' && !playedEvening;
  const players         = s.players as Player[];
  // ANT-131: resolve display names; raw ids only as a last-resort fallback.
  const scenarioTitle   = scenario?.titleUk || scenario?.title || s.scenario_id;
  const locationId      = s.world_state?.currentLocation;
  const location        = locationId
    ? (scenario?.locations?.find((l) => l.id === locationId)?.name
        ?? s.world_state?.dynamicLocations?.[locationId]?.name
        ?? locationId)
    : undefined;
  const snippet         = s.latest_summary || s.last_message || null;
  const campaignSession = s.campaign_id
    ? (sessionLabelsUk[(s.session_number || 1) - 1] ?? `${s.session_number}-та сесія`)
    : null;

  function handleDeleteClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(true);
  }

  function handleConfirm(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onDelete(s.id, e);
  }

  function handleCancel(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(false);
  }

  return (
    <Link href={`/session/${s.id}`} className={`session-card${isClosed ? ' session-card--closed' : ''}`}>
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
          <span>{scenarioTitle}</span>
          <span className="session-card-meta-dot">·</span>
          <span>{formatDate(s.updated_at)}</span>
          {campaignSession && (
            <>
              <span className="session-card-meta-dot">·</span>
              <span>{campaignSession}</span>
            </>
          )}
        </div>

        {location && <div className="session-location">{location}</div>}

        {snippet && (
          <div className="session-summary">{snippet}</div>
        )}

        {players.length > 0 && (
          <div className="session-players">
            {players.map((p, i) => (
              <span key={i} className="session-player-chip">{p.name}</span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="session-card-footer">
          {confirming ? (
            <div className="session-delete-confirm">
              <span className="session-delete-confirm-label">Видалити справу?</span>
              <div className="session-delete-confirm-actions">
                <button className="session-delete-confirm-yes" onClick={handleConfirm}>
                  Так
                </button>
                <button className="session-delete-confirm-no" onClick={handleCancel}>
                  Скасувати
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                className="session-delete-btn"
                onClick={handleDeleteClick}
              >
                Видалити
              </button>
              <span className="session-enter-btn">
                {s.status === 'completed' ? 'Переглянути' : 'Продовжити'} <span aria-hidden="true">→</span>
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SessionList() {
  const router = useRouter();

  const [sessions,  setSessions]  = useState<SessionListEntry[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioCatalogEntry[]>([]);
  const [user,      setUser]      = useState<UserInfo | null>(null);
  const [authMenuOpen, setAuthMenuOpen] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // New-session modal
  const [selectedScenario,  setSelectedScenario]  = useState<ScenarioCatalogEntry | null>(null);
  const [sessionName,       setSessionName]        = useState('');
  const [drafts,            setDrafts]             = useState<DraftPlayer[]>([emptyDraft()]);
  const [pickingRoleFor,    setPickingRoleFor]      = useState<number | null>(null);
  const [language,          setLanguage]            = useState<'uk' | 'en'>('uk');
  const [isCreating,        setIsCreating]          = useState(false);
  const [createError,       setCreateError]         = useState<string | null>(null);
  // ANT-137: dialog semantics — focus moves into the sheet on open, Tab cycles
  // inside it, Escape closes, and focus returns to the trigger on close.
  const modalRef = useRef<HTMLDivElement>(null);
  const modalReturnFocusRef = useRef<HTMLElement | null>(null);

  // ── Load data ────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [sessRes, scRes, meRes] = await Promise.all([
        fetch('/api/sessions'),
        fetch('/api/scenarios'),
        fetch('/api/auth/me'),
      ]);
      const outcome = classifySessionLoad({
        sessionsStatus: sessRes.status,
        scenariosStatus: scRes.status,
        authStatus: meRes.status,
      });
      if (outcome === 'auth') {
        window.location.href = '/auth/login';
        return;
      }
      if (outcome === 'unavailable') {
        throw new Error('session_list_unavailable');
      }

      const [rawSessions, rawScenarios, meData] = await Promise.all([
        sessRes.json(),
        scRes.json(),
        meRes.json(),
      ]);
      if (!Array.isArray(rawSessions) || !Array.isArray(rawScenarios) || !meData?.id) {
        throw new Error('session_list_invalid_response');
      }

      const parsed  = rawSessions.map((s) => normalizeSession(s as RawSession));
      const cached  = loadCachedReadOnlySessions(meData.id);
      setSessions(mergeSessions(parsed, cached));
      setScenarios(rawScenarios);
      setUser(meData);
    } catch (err) {
      console.error('Network error loading data', err);
      setLoadError('Не вдалося завантажити справи та каталог. Перевірте з’єднання й спробуйте ще раз.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── Auth actions ─────────────────────────────────────────────────────────────

  async function handleLogout() {
    clearAllSessionCaches();
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/auth/login');
    router.refresh();
  }

  // ── New-session helpers ──────────────────────────────────────────────────────

  const openModal = useCallback((sc: ScenarioCatalogEntry) => {
    setSelectedScenario(sc);
    setSessionName('');
    setDrafts([emptyDraft()]);
    setPickingRoleFor(null);
    setLanguage('uk');
    setCreateError(null);
  }, []);

  function closeModal() {
    setSelectedScenario(null);
    setPickingRoleFor(null);
    setCreateError(null);
  }

  // ANT-137: focus management for the new-session dialog.
  useEffect(() => {
    if (!selectedScenario) {
      modalReturnFocusRef.current?.focus();
      modalReturnFocusRef.current = null;
      return;
    }
    modalReturnFocusRef.current = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const focusables = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === modalRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectedScenario]);

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
    setCreateError(null);
    const players: Player[] = drafts.map((d) => makePlayer(d.name.trim(), d.preset!));
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: selectedScenario.id, name: sessionName, players, language }),
      });
      if (res.status === 401) {
        window.location.href = '/auth/login';
        return;
      }
      if (!res.ok) {
        setCreateError(sessionCreateErrorCopy(language, res.status));
        return;
      }
      const session = await res.json() as GameSession;
      if (!session.id) {
        setCreateError(sessionCreateErrorCopy(language));
        return;
      }
      track('session_created', {
        scenario_id: selectedScenario.id,
        ruleset: selectedScenario.rulesetId,
        roles_count: players.length,
        language,
      });
      window.location.href = `/session/${session.id}`;
    } catch {
      setCreateError(sessionCreateErrorCopy(language));
    } finally {
      setIsCreating(false);
    }
  }

  async function deleteSession(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    setSessions((p) => p.filter((s) => s.id !== id));
    if (user?.id) removeCachedSession(user.id, id);
  }

  // ── Derived state ─────────────────────────────────────────────────────────────

  // Latest evening number per campaign — a completed evening that is NOT the
  // latest is a "played evening" of an ongoing campaign, not a closed case.
  const latestEveningByCampaign = new Map<string, number>();
  for (const s of sessions) {
    if (s.campaign_id) {
      const n = s.session_number ?? 1;
      latestEveningByCampaign.set(s.campaign_id, Math.max(latestEveningByCampaign.get(s.campaign_id) ?? 0, n));
    }
  }
  const isPlayedEvening = (s: SessionListEntry) =>
    s.status === 'completed' &&
    !!s.campaign_id &&
    (s.session_number ?? 1) < (latestEveningByCampaign.get(s.campaign_id) ?? 0);

  // Played evenings sit with their ongoing campaign under "Відкриті справи";
  // only truly finished games land in "Завершено".
  const openSessions      = sessions.filter((s) => s.status === 'active' || s.status === 'paused' || isPlayedEvening(s));
  const completedSessions = sessions.filter((s) => s.status === 'completed' && !isPlayedEvening(s));

  // scenario_id → cover URL, so session cards can fall back to the scenario
  // cover when there's no session-generated scene yet (ANT-99).
  const coverById: Record<string, string> = Object.fromEntries(
    scenarios.filter((sc) => sc.cover).map((sc) => [sc.id, sc.cover as string])
  );
  // ANT-131: session cards print human-readable scenario titles and location
  // names instead of raw ids (THE-HAUNTING / ELM_STREET_EXTERIOR).
  const scenarioById: Record<string, ScenarioCatalogEntry> = Object.fromEntries(
    scenarios.map((sc) => [sc.id, sc])
  );
  const activeSessions    = sessions.filter((s) => s.status === 'active');
  const pausedSessions    = sessions.filter((s) => s.status === 'paused');
  const totalMessages     = sessions.reduce((acc, s) => acc + (s.message_count ?? 0), 0);

  // ── Render ────────────────────────────────────────────────────────────────────

  // Waiting-list gate (ANT-108): verified accounts that aren't yet approved (or
  // were blocked) can't access the case files. Show a dedicated screen instead.
  if (!loading && user && user.access_status && user.access_status !== 'approved') {
    const blocked = user.access_status === 'blocked';
    return (
      <div className="sessions-page">
        <header className="topbar sessions-topbar">
          <Link href="/" className="mark" style={{ textDecoration: 'none' }}>
            <span className="seal">B</span>
            <span className="wordmark">Barri</span>
          </Link>
          <div className="topbar-right">
            <div className="sessions-authbar sessions-authbar--inline">
              <span className="sessions-authbar-email">{user.email}</span>
              <button className="sessions-authbar-logout" onClick={handleLogout}>Вийти</button>
            </div>
          </div>
        </header>

        <div className="sessions-empty" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 64 }}>
          <span className="sessions-empty-glyph">{blocked ? '✕' : '⧖'}</span>
          <h3>{blocked ? 'Доступ призупинено' : 'Ви у списку очікування'}</h3>
          <p>
            {blocked
              ? 'Доступ до Бюро для цього акаунта наразі закрито. Якщо вважаєте це помилкою — напишіть нам.'
              : 'Дякуємо за реєстрацію! Ми відкриваємо доступ поступово, невеликими групами. Щойно настане ваша черга — ви зможете розпочати розслідування з цього екрана.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sessions-page">

      {/* ── Topbar ── */}
      <header className="topbar sessions-topbar">
        <Link href="/" className="mark" style={{ textDecoration: 'none' }}>
          <span className="seal">B</span>
          <span className="wordmark">Barri</span>
        </Link>

        <div className="topbar-right">
          <span className="sessions-version">v{appVersion}</span>

          {user && (
            <>
              {/* Inline auth — hidden on mobile via CSS */}
              <div className="sessions-authbar sessions-authbar--inline">
                {user.role === 'admin' && (
                  <Link href="/admin" className="sessions-authbar-admin">Admin</Link>
                )}
                <Link href="/account" className="sessions-authbar-email" style={{ textDecoration: 'none' }}>{user.email}</Link>
                <button className="sessions-authbar-logout" onClick={handleLogout}>
                  Вийти
                </button>
              </div>

              {/* Compact menu — visible on mobile only */}
              <div className="sessions-authmenu">
                <button
                  type="button"
                  className="sessions-authmenu-trigger"
                  aria-haspopup="true"
                  aria-expanded={authMenuOpen}
                  aria-label="Меню"
                  onClick={() => setAuthMenuOpen((v) => !v)}
                >
                  <span className="sessions-authmenu-initial">{(user.email[0] || '?').toUpperCase()}</span>
                </button>
                {authMenuOpen && (
                  <>
                    <div
                      className="sessions-authmenu-scrim"
                      onClick={() => setAuthMenuOpen(false)}
                      aria-hidden
                    />
                    <div className="sessions-authmenu-panel" role="menu">
                      <p className="sessions-authmenu-email">{user.email}</p>
                      {user.role === 'admin' && (
                        <Link
                          href="/admin"
                          className="sessions-authmenu-item"
                          onClick={() => setAuthMenuOpen(false)}
                          role="menuitem"
                        >Admin</Link>
                      )}
                      <Link
                        href="/account"
                        className="sessions-authmenu-item"
                        onClick={() => setAuthMenuOpen(false)}
                        role="menuitem"
                      >Акаунт</Link>
                      <button
                        type="button"
                        className="sessions-authmenu-item sessions-authmenu-item--danger"
                        onClick={() => { setAuthMenuOpen(false); handleLogout(); }}
                        role="menuitem"
                      >Вийти</button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {loadError && (
        <div className="sessions-inline-error" role="alert">
          <span>{loadError}</span>
          <button type="button" onClick={() => void loadData()}>
            Спробувати ще раз
          </button>
        </div>
      )}

      {/* ── Bureau stats (Tier 2) ── */}
      {!loadError && !loading && sessions.length > 0 && (
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
      {!loadError && <div className="sessions-section">
        <div className="section-divider">
          <span className="section-divider-title">Відкриті справи</span>
        </div>

        {loading ? (
          <div className="sessions-loading-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="sessions-loading-card" />
            ))}
          </div>
        ) : openSessions.length === 0 ? (
          <div className="sessions-empty">
            <span className="sessions-empty-glyph">ꝏ</span>
            <h3>Жодних відкритих справ</h3>
            <p>Архів порожній. Оберіть справу нижче, щоб розпочати розслідування.</p>
          </div>
        ) : (
          <div className="session-cards-grid">
            {openSessions.map((s) => <SessionCard key={s.id} s={s} onDelete={deleteSession} playedEvening={isPlayedEvening(s)} coverFallback={coverById[s.scenario_id]} scenario={scenarioById[s.scenario_id]} />)}
          </div>
        )}
      </div>}

      {/* ── Closed Investigations (only if any) ── */}
      {!loadError && !loading && completedSessions.length > 0 && (
        <div className="sessions-section">
          <div className="section-divider">
            <span className="section-divider-title">Закриті справи</span>
          </div>
          <div className="session-cards-grid">
            {completedSessions.map((s) => <SessionCard key={s.id} s={s} onDelete={deleteSession} coverFallback={coverById[s.scenario_id]} scenario={scenarioById[s.scenario_id]} />)}
          </div>
        </div>
      )}

      {/* ── Available Case Files (always visible, Tier 1) ── */}
      {!loadError && <div className="sessions-section">
        <div className="section-divider">
          <span className="section-divider-title">Доступні справи</span>
        </div>

        <div className="case-files-grid">
          {scenarios.map((sc) => {
            const diff = difficultyMeta(sc.difficulty);
            const isCampaign = sc.sessionConfig?.isCampaign;
            return (
              <div key={sc.id} className="case-file-card">
                <div className="case-file-thumb">
                  {sc.cover ? (
                    <img src={sc.cover} alt="" loading="lazy" />
                  ) : (
                    <div className="case-file-thumb-fallback" aria-hidden>
                      <span className="case-file-thumb-seal">B</span>
                    </div>
                  )}
                  <span className="case-file-classified">Справа</span>
                </div>
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
      </div>}

      {/* ── New-session modal ── */}
      {selectedScenario && (
        <div className="nsm-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div
            className="nsm-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nsm-title"
            ref={modalRef}
            tabIndex={-1}
          >
            {/* Drag handle (mobile) */}
            <div className="nsm-drag-handle">
              <div className="nsm-drag-bar" />
            </div>

            <div className="nsm-inner">
              {/* Header */}
              <div className="nsm-header">
                <div>
                  <div className="nsm-scenario-label">Справа</div>
                  <div className="nsm-scenario-title" id="nsm-title">{selectedScenario.titleUk}</div>
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
                              <span className="nsm-stat-hp">HP {preset.hp}</span>
                            )}
                            {preset.sanity !== undefined && (
                              <span className="nsm-stat-san">SAN {preset.sanity}</span>
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
                                    <span className="nsm-stat-hp">HP {d.preset.hp}</span>
                                  )}
                                  {d.preset.sanity !== undefined && (
                                    <span className="nsm-stat-san">SAN {d.preset.sanity}</span>
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
                  {/* ANT-137: a disabled button must say why */}
                  {!canCreate && !isCreating && (
                    <p className="nsm-submit-hint">
                      Щоб відкрити справу, заповніть:{' '}
                      {[
                        !sessionName.trim() && 'назву справи',
                        drafts.some((d) => !d.name.trim()) && "ім'я гравця",
                        drafts.some((d) => !d.preset) && 'клас гравця',
                      ].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {createError && (
                    <p className="nsm-create-error" role="alert">
                      {createError}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
