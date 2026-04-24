'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useState, useEffect, useRef } from 'react';
import type { GameSession, Message, Player, ScenarioBriefing, NPC } from '@/types';
import type { Segment } from '@/lib/segments';
import { hasNpcSpeech, parseSegments, stripNpcTags } from '@/lib/segments';
import { resolvePlayerStats } from '@/lib/statUtils';
import type { AiProvider } from '@/app/api/ai/route';
import VoiceButton from './VoiceButton';
import DiceRoller from './DiceRoller';

const READ_ONLY_SESSION_CACHE_KEY = 'barri.readOnlySessions';

type ReadOnlySessionSnapshot = GameSession & { last_message?: string };
type CompletionMode = 'complete-session' | 'finish-evening';
type CompletionTrigger = 'keeper' | 'manual';

interface CompletionRequest {
  mode: CompletionMode;
  endedEarly: boolean;
  trigger: CompletionTrigger;
}

interface CompletionStats {
  startedAt: string;
  completedAt: string;
  messageCount: number;
  keeperMessageCount: number;
  playerMessageCount: number;
  durationMinutes: number;
}

interface CompletionResponse {
  session: GameSession;
  nextSession?: GameSession | null;
  stats?: CompletionStats;
}

function isSessionReadOnly(status: string | undefined) {
  return status === 'completed' || status === 'paused';
}

function getStatusMeta(session: GameSession) {
  const isCampaign = Boolean(session.campaign_id);
  const wasEndedEarly = Boolean(session.ended_early);

  if (session.status === 'completed') {
    return {
      isReadOnly: true,
      badge: wasEndedEarly
        ? (isCampaign ? 'Вечір закрито достроково' : 'Сесію закрито достроково')
        : (isCampaign ? 'Вечір кампанії завершено' : 'Сесію завершено'),
      summary: isCampaign
        ? (wasEndedEarly
            ? 'Поточний вечір закрито вручну достроково. Історія лишається доступною для перегляду.'
            : 'Вечір завершено. Історія, матеріали справи та озвучення лишаються доступними для перегляду.')
        : (wasEndedEarly
            ? 'Сесію закрито вручну достроково. Чат збережено в режимі лише для перегляду.'
            : 'Сесію завершено. Чат збережено в режимі лише для перегляду.'),
      completeLabel: isCampaign ? 'Завершити кампанію достроково' : 'Закрити сесію достроково',
      finishLabel: isCampaign ? 'Завершити вечір достроково' : '',
    };
  }

  if (session.status === 'paused') {
    return {
      isReadOnly: true,
      badge: isCampaign ? 'Кампанію поставлено на паузу' : 'Сесію поставлено на паузу',
      summary: 'Нові ходи тимчасово вимкнено. Поточну історію можна спокійно переглядати.',
      completeLabel: '',
      finishLabel: '',
    };
  }

  return {
    isReadOnly: false,
    badge: isCampaign ? 'Кампанійна сесія' : 'Активна сесія',
    summary: isCampaign
      ? 'Сесія триває. Кіпер має завершити вечір, коли історія природно дійде до фіналу.'
      : 'Сесія триває. Кіпер має завершити сесію, коли сценарій справді пройдено.',
    completeLabel: isCampaign ? 'Завершити кампанію достроково' : 'Закрити сесію достроково',
    finishLabel: isCampaign ? 'Завершити вечір достроково' : '',
  };
}

function upsertReadOnlySessionCache(snapshot: ReadOnlySessionSnapshot) {
  if (typeof window === 'undefined') return;

  try {
    const raw = window.sessionStorage.getItem(READ_ONLY_SESSION_CACHE_KEY);
    const cached = raw ? (JSON.parse(raw) as ReadOnlySessionSnapshot[]) : [];
    const next = [snapshot, ...cached.filter((item) => item.id !== snapshot.id)].slice(0, 12);
    window.sessionStorage.setItem(READ_ONLY_SESSION_CACHE_KEY, JSON.stringify(next));
  } catch {
    // Ignore cache persistence issues and keep the session usable.
  }
}

function buildLocalCompletionStats(session: GameSession, messages: Message[]): CompletionStats {
  const completedAt = session.completed_at ?? session.updated_at;
  const keeperMessageCount = messages.filter((message) => message.role === 'assistant').length;
  const durationMs = Math.max(
    0,
    new Date(completedAt).getTime() - new Date(session.created_at).getTime()
  );

  return {
    startedAt: session.created_at,
    completedAt,
    messageCount: messages.length,
    keeperMessageCount,
    playerMessageCount: Math.max(0, messages.length - keeperMessageCount),
    durationMinutes: Math.round(durationMs / 60000),
  };
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      onClick={onChange}
      className="chat-toggle"
      title={`${checked ? 'Вимкнути' : 'Увімкнути'} ${label}`}
    >
      <span className={`chat-toggle-track${checked ? ' is-on' : ''}`}>
        <span className="chat-toggle-thumb" />
      </span>
      <span>{label}</span>
    </button>
  );
}


interface GameChatProps {
  session: GameSession;
  initialMessages: Message[];
  briefing?: ScenarioBriefing | null;
  locationNames?: Record<string, string>;
  ambientByLocation?: Record<string, string>;
  scenarioNpcs?: NPC[];
  rulesetId?: string;
  defaultAiProvider?: AiProvider;
  defaultTtsProvider?: 'openai' | 'gemini';
  defaultGeminiCacheEnabled?: boolean;
  isAdmin?: boolean;
}

// msgId → { prompt, type }
interface DynamicImageMeta { prompt: string; type: string }

// Inline image component for dynamic images
// CHANGED: Supports static url resolving from session
function DynamicImage({ prompt, type, sessionId, msgId, url, onUrlGenerated }: { prompt: string; type: string; sessionId: string; msgId?: string; url?: string; onUrlGenerated?: (msgId: string, url: string) => void }) {
  const [src, setSrc]         = useState<string | null>(url || null);
  const [error, setError]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const fetched = useRef(false);
  const resolvedSrc = url ?? src;

  // Self-heal: if a URL was provided by the parent but somehow sessionImages isn't persisted,
  // re-trigger onUrlGenerated so the retrying PATCH has another chance.
  useEffect(() => {
    if (url && msgId && onUrlGenerated) onUrlGenerated(msgId, url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, msgId]);

  const doFetch = () => {
    if (!msgId || !onUrlGenerated) return;
    setLoading(true);
    setError(false);
    const urlStr = `/api/image?prompt=${encodeURIComponent(prompt)}&type=${encodeURIComponent(type)}&sessionId=${encodeURIComponent(sessionId)}&json=true`;
    fetch(urlStr)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (data.url) {
          setSrc(data.url);
          onUrlGenerated(msgId, data.url);
          setLoading(false);
        } else {
          setError(true);
          setLoading(false);
        }
      })
      .catch((e) => {
        console.warn('[DynamicImage] fetch failed:', e);
        setError(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (url) return;
    if (fetched.current || !msgId || !onUrlGenerated) return;
    fetched.current = true;
    doFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, type, sessionId, url, msgId, onUrlGenerated]);

  if (error && !resolvedSrc) {
    return (
      <div className="chat-image-error" style={{ minHeight: 120 }}>
        <span>Не вдалося згенерувати зображення</span>
        <button
          type="button"
          onClick={() => { fetched.current = true; doFetch(); }}
          disabled={loading}
          className="chat-small-btn"
        >
          {loading ? 'Спроба…' : '↻ Спробувати ще раз'}
        </button>
      </div>
    );
  }

  if (!resolvedSrc) {
    return (
      <div className="chat-image-loading" style={{ height: 160 }}>
        <span className="chat-image-loading-text">Генерується зображення...</span>
      </div>
    );
  }

  return (
    <>
      <img
        src={resolvedSrc}
        alt=""
        onClick={() => setFullscreen(true)}
        className="chat-dynamic-img"
        style={{ maxHeight: 220 }}
      />
      {fullscreen && typeof document !== 'undefined' && createPortal(
        <div
          className="chat-lightbox"
          onClick={() => setFullscreen(false)}
        >
          <img src={resolvedSrc} alt="" />
        </div>,
        document.body
      )}
    </>
  );
}

// Bold-text renderer: **text** → <strong>
function renderText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : p
  );
}

// Case files panel — sidebar: always-visible on desktop, overlay on mobile
function CaseFilesPanel({
  scenarioId,
  rulesetId,
  players,
  briefing,
  npcs,
  npcRelations,
  npcDetails,
  dynamicNpcs,
  dynamicImages,
  sessionImages,
  onUrlGenerated,
  sessionId,
  onClose,
}: {
  scenarioId: string;
  rulesetId: string;
  players: Player[];
  briefing?: ScenarioBriefing | null;
  npcs: NPC[];
  npcRelations: Record<string, 'friendly' | 'neutral' | 'hostile' | 'unknown'>;
  npcDetails?: Record<string, { notes: string }>;
  dynamicNpcs?: { id: string; name: string }[];
  dynamicImages: Record<string, DynamicImageMeta>;
  sessionImages?: Record<string, string>;
  onUrlGenerated?: (msgId: string, url: string) => void;
  sessionId: string;
  onClose?: () => void;
}) {
  type Tab = 'briefing' | 'players' | 'images' | 'npcs';
  const [tab, setTab]           = useState<Tab>('briefing');
  const [images, setImages]     = useState<{ id: string; url: string; label: string }[]>([]);
  const [imagesScenarioId, setImagesScenarioId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState<string | null>(null);
  const loadingImgs = tab === 'images' && imagesScenarioId !== scenarioId;
  const visibleImages = imagesScenarioId === scenarioId ? images : [];

  useEffect(() => {
    if (tab !== 'images' || imagesScenarioId === scenarioId) return;

    fetch(`/api/scenarios/${scenarioId}/images`)
      .then((r) => r.json())
      .then((d) => { setImages(d.images ?? []); setImagesScenarioId(scenarioId); })
      .catch(() => { setImages([]); setImagesScenarioId(scenarioId); });
  }, [imagesScenarioId, scenarioId, tab]);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'briefing', label: 'Справa' },
    { id: 'players',  label: 'Команда' },
    { id: 'images',   label: 'Матеріали' },
    { id: 'npcs',     label: 'Контакти' },
  ];

  const metNpcs = npcs.filter((n) => n.id in npcRelations);
  const allNpcs: { id: string; name: string; description?: string; isDynamic?: boolean }[] = [
    ...metNpcs.map((n) => ({ id: n.id, name: n.name, description: n.description })),
    ...(dynamicNpcs ?? []).filter((d) => !(metNpcs.some((n) => n.id === d.id))).map((d) => ({ ...d, isDynamic: true })),
  ];
  const sessionEvidenceCount = Object.keys(dynamicImages).length;
  const archiveEvidenceCount = visibleImages.length;
  const activeNpcCount = allNpcs.length;
  const inventoryCount = players.reduce((total, player) => total + (player.inventory?.length ?? 0), 0);
  const premisePreview = briefing?.premise
    ? (briefing.premise.length > 180 ? `${briefing.premise.slice(0, 180).trim()}…` : briefing.premise)
    : null;

  const fullscreenOverlay = fullscreen && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="chat-lightbox"
          onClick={() => setFullscreen(null)}
        >
          <img src={fullscreen} alt="" />
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <div className="case-panel">
        {/* Header */}
        <div className="case-panel-header">
          <div>
            <p className="case-panel-kicker">Confidential</p>
            <h2>Матеріали справи</h2>
            <p className="case-panel-fileid">Case file: {scenarioId}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="chat-icon-btn case-panel-close"
              title="Закрити"
            >✕</button>
          )}
        </div>

        <div className="case-meta-strip">
          <span className="case-meta-chip">Осіб у справі: {players.length}</span>
          <span className="case-meta-chip">Предметів: {inventoryCount}</span>
          <span className="case-meta-chip">Контактів: {activeNpcCount}</span>
          <span className="case-meta-chip">Exhibits: {sessionEvidenceCount + archiveEvidenceCount}</span>
        </div>

        <div className="case-overview">
          <div className="case-overview-card case-overview-card--primary">
            <span className="case-overview-label">Current objective</span>
            <p>{briefing?.objective ?? 'Зберіть докази, зводьте контакти й рухайте справу вперед.'}</p>
          </div>
          <div className="case-overview-grid">
            <div className="case-overview-card">
              <span className="case-overview-label">Setting</span>
              <p>{briefing?.setting ?? 'Обстановка ще уточнюється по ходу справи.'}</p>
            </div>
            {premisePreview && (
              <div className="case-overview-card">
                <span className="case-overview-label">Case summary</span>
                <p>{premisePreview}</p>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="case-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`case-tab${tab === t.id ? ' is-active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="case-panel-body">

          {/* ── Briefing ── */}
          {tab === 'briefing' && (
            <div className="case-section">
              <div className="case-cover-sheet">
                <div className="case-cover-row">
                  <span className="case-cover-label">Filed under</span>
                  <strong>{scenarioId}</strong>
                </div>
                <div className="case-cover-grid">
                  <div>
                    <span className="case-cover-label">Investigators</span>
                    <strong>{players.length}</strong>
                  </div>
                  <div>
                    <span className="case-cover-label">Persons of interest</span>
                    <strong>{activeNpcCount}</strong>
                  </div>
                  <div>
                    <span className="case-cover-label">Known exhibits</span>
                    <strong>{sessionEvidenceCount + archiveEvidenceCount}</strong>
                  </div>
                </div>
              </div>
              {!briefing ? (
                <p className="case-empty">Опис відсутній</p>
              ) : (
                <>
                  <div className="case-note">
                    <p className="case-note-label">Обстановка</p>
                    <p>{briefing.setting}</p>
                  </div>
                  <div className="case-note">
                    <p className="case-note-label">Що сталось</p>
                    <p className="whitespace-pre-line">{briefing.premise}</p>
                  </div>
                  <div className="case-note">
                    <p className="case-note-label">Завдання</p>
                    <p>{briefing.objective}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Players ── */}
          {tab === 'players' && (
            <div className="case-section">
              {players.map((p, i) => (
                <div key={i} className="case-card">
                  <div className="case-card-head">
                    <span>{p.name}</span>
                    <small>{p.role}</small>
                  </div>
                  {p.background && (
                    <p className="case-card-copy">{p.background}</p>
                  )}
                  <div className="case-stat-row">
                    {resolvePlayerStats(p, rulesetId).map((s) => (
                      <span key={s.id} style={{ color: s.color }}>
                        {s.label} {s.value}{s.hasMax && s.max !== null ? `/${s.max}` : ''}
                      </span>
                    ))}
                  </div>
                  {Object.keys(p.skills).length > 0 && (
                    <div className="case-skill-grid">
                      {Object.entries(p.skills).map(([skill, val]) => (
                        <div key={skill}>
                          <span>{skill}</span>
                          <b>{val}</b>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="case-inventory-block">
                    <p className="case-note-label">Інвентар</p>
                    {(p.inventory?.length ?? 0) === 0 ? (
                      <p className="case-card-copy">Поки що без речових доказів і спорядження.</p>
                    ) : (
                      <div className="case-item-list">
                        {(p.inventory ?? []).map((item) => (
                          <div key={item.id} className={`case-item${item.broken ? ' is-broken' : ''}${item.equipped ? ' is-equipped' : ''}`}>
                            <div className="case-item-head">
                              <span>{item.name}</span>
                              <small>
                                {item.broken ? 'зламано' : item.uses === -1 ? '∞' : `×${item.uses}`}
                              </small>
                            </div>
                            <p>{item.description}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Images ── */}
          {tab === 'images' && (
            <div className="case-section">
              {/* Session-generated images */}
              {Object.keys(dynamicImages).length > 0 && (
                <div>
                  <p className="case-note-label">Сесійні матеріали</p>
                  <div className="case-evidence-list">
                    {Object.entries(dynamicImages).map(([msgId, meta], index) => (
                      <div key={msgId} className="case-evidence">
                        <div className="case-evidence-head">
                          <span className="case-evidence-stamp">Exhibit S-{index + 1}</span>
                          <span className="case-evidence-type">{meta.type}</span>
                        </div>
                        <DynamicImage prompt={meta.prompt} type={meta.type} sessionId={sessionId} msgId={msgId} url={sessionImages?.[msgId]} onUrlGenerated={onUrlGenerated} />
                        <p title={meta.prompt}>
                          {meta.prompt.length > 50 ? meta.prompt.slice(0, 50) + '…' : meta.prompt}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Static scenario images */}
              {Object.keys(dynamicImages).length > 0 && (visibleImages.length > 0 || loadingImgs) && (
                <div className="case-divider">
                  <p className="case-note-label">Сценарні матеріали</p>
                </div>
              )}
              {loadingImgs && (
                <p className="case-empty">Завантаження...</p>
              )}
              {!loadingImgs && visibleImages.length === 0 && Object.keys(dynamicImages).length === 0 && (
                <p className="case-empty">Матеріали ще генеруються...</p>
              )}
              {visibleImages.map((img, index) => (
                <div key={img.id} className="case-evidence">
                  <div className="case-evidence-head">
                    <span className="case-evidence-stamp">Archive {index + 1}</span>
                    <span className="case-evidence-type">scenario</span>
                  </div>
                  <img
                    src={img.url}
                    alt={img.label}
                    onClick={() => setFullscreen(img.url)}
                    className="case-evidence-img"
                    style={{ maxHeight: 160 }}
                  />
                  <p>{img.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── NPCs ── */}
          {tab === 'npcs' && (
            <div className="case-section">
              {allNpcs.length === 0 ? (
                <p className="case-empty">Персонажі ще не зустрічались</p>
              ) : (
                allNpcs.map((npc) => {
                  const relation = npcRelations[npc.id];
                  const relClass =
                    relation === 'friendly' ? 'is-friendly' :
                    relation === 'hostile'  ? 'is-hostile'  :
                    relation === 'neutral'  ? 'is-neutral'  :
                                             'is-unknown';
                  const relLabel =
                    relation === 'friendly' ? 'Дружній'    :
                    relation === 'hostile'  ? 'Ворожий'    :
                    relation === 'neutral'  ? 'Нейтральний': 'Невідомо';
                  return (
                    <div key={npc.id} className="case-card case-card--npc">
                      <div className="case-card-head">
                        <span>{npc.name}</span>
                        <div className="case-card-head-tags">
                          {npc.isDynamic && <small className="case-origin-tag">Новий контакт</small>}
                          <small className={`case-relation ${relClass}`}>{relLabel}</small>
                        </div>
                      </div>
                      {npc.description && (
                        <p className="case-card-copy">{npc.description}</p>
                      )}
                      {npcDetails?.[npc.id]?.notes && (
                        <p className="case-npc-note">{npcDetails[npc.id].notes}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {fullscreenOverlay}
    </>
  );
}

// ── SSE helper ───────────────────────────────────────────────────────────────

async function readSseStream(
  res: Response,
  onChunk: (text: string) => void
): Promise<Record<string, unknown> | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      if (!part.trim()) continue;
      const lines = part.split('\n');
      let eventType = '';
      let dataStr = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) eventType = line.slice(7).trim();
        else if (line.startsWith('data: ')) dataStr = line.slice(6);
      }
      if (!dataStr) continue;
      try {
        const data = JSON.parse(dataStr) as Record<string, unknown>;
        if (eventType === 'chunk') onChunk((data.text as string) ?? '');
        else if (eventType === 'done') return data;
        else if (eventType === 'error') throw new Error((data.message as string) ?? 'AI error');
      } catch (e) {
        if (eventType === 'error') throw e;
      }
    }
  }
  return null;
}

export default function GameChat({ session: initialSession, initialMessages, briefing, locationNames = {}, ambientByLocation: initialAmbientByLocation = {}, scenarioNpcs = [], rulesetId = 'coc_7e', defaultAiProvider = 'gemini-flash', defaultTtsProvider = 'gemini', defaultGeminiCacheEnabled = false, isAdmin = false }: GameChatProps) {
  const [session, setSession]   = useState<GameSession>(initialSession);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [completionRequest, setCompletionRequest] = useState<CompletionRequest | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [completionStats, setCompletionStats] = useState<CompletionStats | null>(
    initialSession.status === 'completed'
      ? buildLocalCompletionStats(initialSession, initialMessages)
      : null
  );

  const persistSessionImages = async (sessionId: string, worldState: GameSession['world_state']) => {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ world_state: worldState }),
        });
        if (res.ok) return true;
        console.warn(`[sessionImages PATCH] attempt ${attempt}/${maxAttempts} failed: ${res.status}`);
      } catch (e) {
        console.warn(`[sessionImages PATCH] attempt ${attempt}/${maxAttempts} error:`, e);
      }
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
    console.error('[sessionImages PATCH] giving up after 3 attempts — image URL not persisted');
    return false;
  };

  const handleUrlGenerated = (msgId: string, url: string) => {
    setSession((s) => {
      const existing = s.world_state.sessionImages ?? {};
      if (existing[msgId] === url) return s;
      const updatedImages = { ...existing, [msgId]: url };
      const updatedWorldState = { ...s.world_state, sessionImages: updatedImages };
      void persistSessionImages(s.id, updatedWorldState);
      return { ...s, world_state: updatedWorldState };
    });
  };

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [voiceStyles, setVoiceStyles]         = useState<Record<string, string>>({});
  const [msgSegments, setMsgSegments]         = useState<Record<string, Segment[]>>({});
  const [dynamicImages, setDynamicImages]     = useState<Record<string, DynamicImageMeta>>({});
  const [input, setInput]       = useState('');
  const [isLoading, setIsLoading]             = useState(false);
  const [speakingId, setSpeakingId]           = useState<string | null>(null);
  const [loadingAudioIds, setLoadingAudioIds] = useState<Set<string>>(new Set());
  const [activePlayer, setActivePlayer]       = useState(0);
  const [showSettings, setShowSettings]       = useState(false);
  const [showSidebar, setShowSidebar]         = useState(false);
  const [debugFor, setDebugFor]               = useState<string | null>(null);
  const [debugData, setDebugData]             = useState<unknown>(null);
  const [debugError, setDebugError]           = useState<string | null>(null);
  const [pendingActions, setPendingActions]   = useState<{ playerIdx: number; text: string }[]>([]);
  const statusMeta = getStatusMeta(session);
  const sessionIsReadOnly = statusMeta.isReadOnly;
  const canManuallyEndSession = !sessionIsReadOnly;
  const lastMessagePreview = (() => {
    const lastMessage = [...messages].reverse().find((message) => message.content.trim().length > 0);
    return lastMessage?.content;
  })();
  const [ambientEnabled, setAmbientEnabled]   = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ambientEnabled') !== 'false';
    }
    return true;
  });
  const [autoVoiceEnabled, setAutoVoiceEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('autoVoiceEnabled') === 'true';
    }
    return false;
  });
  const [ambientVolume, setAmbientVolume]     = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return parseFloat(localStorage.getItem('ambientVolume') ?? '0.35');
    }
    return 0.35;
  });
  const [currentLocation, setCurrentLocation]     = useState<string | null>(
    initialSession.world_state?.currentLocation ?? null
  );
  const [currentLocationName, setCurrentLocationName] = useState<string | null>(() => {
    const locId = initialSession.world_state?.currentLocation;
    return locId ? (locationNames[locId] ?? null) : null;
  });
  const [ambientByLocation, setAmbientByLocation] = useState<Record<string, string>>(initialAmbientByLocation);

  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const textareaRef       = useRef<HTMLTextAreaElement>(null);
  const audioRef          = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef     = useRef<Map<string, string>>(new Map());
  const ambientRef        = useRef<HTMLAudioElement | null>(null);
  const currentAmbientUrlRef = useRef<string | null>(null);
  const [ttsProvider]         = useState<'openai' | 'gemini'>(defaultTtsProvider);
  const [aiProvider]          = useState<AiProvider>(defaultAiProvider);
  const [geminiCacheEnabled]  = useState<boolean>(defaultGeminiCacheEnabled);
  // CHANGED: KeeperStyle — controls Keeper activity level
  const [keeperStyle, setKeeperStyle] = useState<'passive' | 'balanced' | 'active'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('keeperStyle') as 'passive' | 'balanced' | 'active') ?? 'balanced';
    }
    return 'balanced';
  });
  const [diceMode, setDiceMode] = useState<'virtual' | 'physical'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('diceMode') as 'virtual' | 'physical') ?? 'virtual';
    }
    return 'virtual';
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isSessionReadOnly(session.status)) return;
    upsertReadOnlySessionCache({ ...session, last_message: lastMessagePreview });
  }, [lastMessagePreview, session]);

  // Parse NPC segments and dynamic images from initial messages so speech bubbles survive reload
  useEffect(() => {
    const initial: Record<string, Segment[]> = {};
    const initialImgs: Record<string, DynamicImageMeta> = {};
    for (const msg of initialMessages) {
      if (msg.role === 'assistant') {
        const segs = parseSegments(msg.content, scenarioNpcs);
        if (hasNpcSpeech(segs)) initial[msg.id] = segs;
        
        const imgMatch = msg.content.match(/\[IMAGE:(\w+):([^\]]+)\]/);
        if (imgMatch) {
          initialImgs[msg.id] = { type: imgMatch[1], prompt: imgMatch[2].trim() };
        }
      }
    }
    if (Object.keys(initial).length > 0) setMsgSegments(initial);
    if (Object.keys(initialImgs).length > 0) setDynamicImages(initialImgs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger static image generation in background when session starts
  useEffect(() => {
    fetch(`/api/scenarios/${session.scenario_id}/images`, { method: 'POST' }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger ambient generation in background when session starts.
  // Files are persisted in shared storage, so subsequent sessions should resolve instantly.
  useEffect(() => {
    let cancelled = false;

    fetch(`/api/scenarios/${session.scenario_id}/ambient`, { method: 'POST' })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        if (cancelled || !data.ambientByLocation) return;
        setAmbientByLocation((prev) => ({ ...prev, ...(data.ambientByLocation as Record<string, string>) }));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-generate intro if no messages yet
  const introRequested = useRef(false);
  useEffect(() => {
    if (initialMessages.length !== 0 || introRequested.current || initialSession.status !== 'active') return;
    introRequested.current = true;
    setIsLoading(true);

    const introId = Date.now().toString();
    // Show empty optimistic bubble immediately
    setMessages([{
      id: introId,
      session_id: session.id,
      role: 'assistant',
      content: '',
      player_idx: null,
      created_at: new Date().toISOString(),
    }]);

    fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        message: '__intro__',
        playerIdx: 0,
        aiProvider,
        autoVoiceEnabled,
        keeperStyle,
        geminiCacheEnabled,
      }),
    })
      .then(async (res) => {
        if (!res.ok || !res.body) throw new Error('Intro failed');
        const data = await readSseStream(res, (chunk) => {
          setMessages((prev) => prev.map((m) =>
            m.id === introId ? { ...m, content: m.content + chunk } : m
          ));
        });
        if (!data) return;
        const introRealId = (data.messageId as string | undefined) ?? introId;
        setMessages((prev) => prev.map((m) =>
          m.id === introId ? { ...m, id: introRealId, content: data.response as string } : m
        ));
        if (data.voiceStyle)  setVoiceStyles({ [introRealId]: data.voiceStyle as string });
        if (data.segments)    setMsgSegments({ [introRealId]: data.segments as Segment[] });
        if (data.world_state) setSession((s) => ({ ...s, world_state: data.world_state as typeof s.world_state }));
        if (data.imagePrompt) setDynamicImages({ [introRealId]: { prompt: data.imagePrompt as string, type: (data.imageType as string) ?? 'scene' } });
        if (data.location)    {
          setCurrentLocation(data.location as string);
          setCurrentLocationName((data.locationName as string | null) ?? null);
          playAmbient(data.location as string, (data.ambientFile as string | null | undefined) ?? null);
        }
        if (autoVoiceEnabled) speakMsg(introRealId, data.response as string, data.voiceStyle as string | undefined, data.segments as Segment[] | undefined);
      })
      .catch(() => {
        setMessages([{
          id: introId,
          session_id: session.id,
          role: 'assistant',
          content: 'Не вдалося запустити гру. Перезавантаж сторінку.',
          player_idx: null,
          created_at: new Date().toISOString(),
        }]);
      })
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiProvider, autoVoiceEnabled, initialMessages.length, session.id]);

  // ── TTS ─────────────────────────────────────────────────────────────────────

  function stopAudio() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
  }

  function fadeOutAmbient(audio: HTMLAudioElement) {
    const fadeOut = setInterval(() => {
      if (audio.volume > 0.05) { audio.volume = Math.max(0, audio.volume - 0.05); }
      else { clearInterval(fadeOut); audio.pause(); audio.src = ''; }
    }, 80);
  }

  function stopAmbient() {
    const prev = ambientRef.current;
    currentAmbientUrlRef.current = null;
    ambientRef.current = null;

    if (prev) fadeOutAmbient(prev);
  }

  function playAmbientFile(url: string | null) {
    if (!url) {
      stopAmbient();
      return;
    }

    if (currentAmbientUrlRef.current === url && ambientRef.current) {
      if (ambientEnabled && ambientRef.current.paused) {
        ambientRef.current.volume = 0;
        ambientRef.current.play().then(() => { ambientRef.current!.volume = ambientVolume; }).catch(() => {});
      }
      return;
    }

    const prev = ambientRef.current;
    if (prev) fadeOutAmbient(prev);
    currentAmbientUrlRef.current = url;

    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = 0;
    ambientRef.current = audio;

    if (!ambientEnabled) return;

    audio.play().then(() => {
      const target = ambientVolume;
      const fadeIn = setInterval(() => {
        if (audio.volume < target - 0.04) { audio.volume = Math.min(target, audio.volume + 0.04); }
        else { audio.volume = target; clearInterval(fadeIn); }
      }, 80);
    }).catch(() => {/* autoplay blocked */});
  }

  function playAmbient(locationId: string, explicitUrl?: string | null) {
    const url = explicitUrl ?? ambientByLocation[locationId] ?? null;
    playAmbientFile(url);
  }

  useEffect(() => {
    if (!currentLocation) return;
    playAmbient(currentLocation);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation, ambientByLocation]);

  // Sync ambient volume/enabled state
  useEffect(() => {
    if (ambientRef.current) {
      if (ambientEnabled) {
        if (ambientRef.current.paused && currentLocation) {
          ambientRef.current.volume = 0;
          ambientRef.current.play().then(() => { ambientRef.current!.volume = ambientVolume; }).catch(() => {});
        } else {
          ambientRef.current.volume = ambientVolume;
        }
      } else {
        ambientRef.current.pause();
      }
    }
    localStorage.setItem('ambientEnabled', String(ambientEnabled));
    localStorage.setItem('ambientVolume', String(ambientVolume));
  }, [ambientEnabled, ambientVolume, currentLocation]);

  useEffect(() => {
    return () => {
      if (ambientRef.current) {
        ambientRef.current.pause();
        ambientRef.current.src = '';
      }
      currentAmbientUrlRef.current = null;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('autoVoiceEnabled', String(autoVoiceEnabled));
  }, [autoVoiceEnabled]);

  // CHANGED: KeeperStyle toggle — persisted to localStorage
  function changeKeeperStyle(s: 'passive' | 'balanced' | 'active') {
    localStorage.setItem('keeperStyle', s);
    setKeeperStyle(s);
  }

  function toggleDiceMode() {
    setDiceMode((prev) => {
      const next = prev === 'virtual' ? 'physical' : 'virtual';
      localStorage.setItem('diceMode', next);
      return next;
    });
  }

  async function exportChatLog() {
    try {
      const res = await fetch(`/api/admin/sessions/${session.id}/export`);
      if (!res.ok) {
        alert(`Export failed: ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `barri-session-${session.id}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export chat log error:', e);
      alert('Export failed');
    }
  }

  async function openDebug(msgId: string) {
    setDebugFor(msgId);
    setDebugData(null);
    setDebugError(null);
    try {
      const res = await fetch(`/api/admin/messages/${msgId}/debug`);
      if (res.status === 404) {
        setDebugError('No debug data saved for this message (predates feature or non-assistant).');
        return;
      }
      if (!res.ok) {
        setDebugError(`Error ${res.status}`);
        return;
      }
      setDebugData(await res.json());
    } catch (e) {
      setDebugError(String(e));
    }
  }

  function closeDebug() {
    setDebugFor(null);
    setDebugData(null);
    setDebugError(null);
  }

  function downloadDebug() {
    if (!debugData || !debugFor) return;
    const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barri-debug-${debugFor}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function speakMsg(msgId: string, text: string, voiceStyle?: string, segments?: Segment[]) {
    stopAudio();
    const cached = audioCacheRef.current.get(msgId);
    if (cached) { playUrl(msgId, cached); return; }

    setLoadingAudioIds((prev) => new Set(prev).add(msgId));
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceStyle: voiceStyle ?? 'keeper',
          provider: ttsProvider,
          segments: ttsProvider === 'gemini' ? segments : undefined,
          sessionId: session.id, // CHANGED: pass for cost tracking
        }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      audioCacheRef.current.set(msgId, url);
      playUrl(msgId, url);
    } catch {
      fallbackTTS(text);
    } finally {
      setLoadingAudioIds((prev) => { const s = new Set(prev); s.delete(msgId); return s; });
    }
  }

  function playUrl(msgId: string, url: string) {
    const audio = new Audio(url);
    audioRef.current = audio;
    setSpeakingId(msgId);
    audio.onended = () => setSpeakingId(null);
    audio.onerror = () => setSpeakingId(null);
    audio.play().catch(() => setSpeakingId(null));
  }

  function fallbackTTS(text: string) {
    if (!window.speechSynthesis) return;
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'uk-UA'; utt.rate = 0.85; utt.pitch = 0.9;
    utt.onend = () => setSpeakingId(null);
    window.speechSynthesis.speak(utt);
  }

  function handleReplay(msgId: string, text: string) {
    if (speakingId === msgId) { stopAudio(); return; }
    if (loadingAudioIds.has(msgId)) return;
    speakMsg(msgId, text, voiceStyles[msgId], msgSegments[msgId]);
  }

  // ── Item use ─────────────────────────────────────────────────────────────────

  function handleUseItem(playerIdx: number, _itemId: string, itemName: string) {
    if (sessionIsReadOnly) return;
    // Inventory mutation is authoritative on the server: when the keeper emits
    // [USE_ITEM:idx:itemId] the /api/ai route decrements uses and returns the
    // updated players array. The client only nudges the prompt so the keeper
    // knows which item to reference.
    setActivePlayer(playerIdx);
    setInput((prev) => prev ? `${prev} (використовує: ${itemName})` : `(використовує: ${itemName}) `);
    textareaRef.current?.focus();
  }

  // ── Queue action ─────────────────────────────────────────────────────────────

  function queueAction() {
    if (sessionIsReadOnly) return;
    const text = input.trim();
    if (!text) return;
    setPendingActions((prev) => [...prev, { playerIdx: activePlayer, text }]);
    setInput('');
    // advance to next player automatically
    setActivePlayer((i) => (i + 1) % session.players.length);
  }

  function removePending(idx: number) {
    setPendingActions((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Send message ─────────────────────────────────────────────────────────────

  async function sendMessage(text?: string) {
    if (sessionIsReadOnly) return;
    const immediate = (text || input).trim();

    // Build full action list
    const allActions = immediate
      ? [...pendingActions, { playerIdx: activePlayer, text: immediate }]
      : [...pendingActions];

    if (allActions.length === 0 || isLoading) return;

    setInput('');
    setPendingActions([]);
    setIsLoading(true);

    // Build combined message for AI
    const combinedMessage = allActions.length === 1
      ? allActions[0].text  // API route adds [Name]: prefix itself
      : allActions.map((a) => {
          const name = session.players[a.playerIdx]?.name;
          return name ? `[${name}]: ${a.text}` : a.text;
        }).join('\n');

    // Show each action as individual bubble in chat
    const now = Date.now();
    const newUserMsgs: Message[] = allActions.map((a, i) => ({
      id: (now + i).toString(),
      session_id: session.id,
      role: 'user',
      content: a.text,
      player_idx: a.playerIdx,
      created_at: new Date().toISOString(),
    }));
    setMessages((prev) => [...prev, ...newUserMsgs]);

    // Optimistic assistant bubble — shows streaming text as it arrives
    const optimisticId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, {
      id: optimisticId,
      session_id: session.id,
      role: 'assistant' as const,
      content: '',
      player_idx: null,
      created_at: new Date().toISOString(),
    }]);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          message: combinedMessage,
          playerIdx: allActions[0].playerIdx,
          allActions: allActions.length > 1 ? allActions : undefined,
          aiProvider,
          autoVoiceEnabled,
          keeperStyle,
          geminiCacheEnabled,
        }),
      });
      if (!res.ok || !res.body) throw new Error('AI request failed');

      const data = await readSseStream(res, (chunk) => {
        setMessages((prev) => prev.map((m) =>
          m.id === optimisticId ? { ...m, content: m.content + chunk } : m
        ));
      });
      if (!data) throw new Error('No response from AI');

      // Replace streaming preview with clean server text + update all state
      // Remap optimistic local ID → real DB message ID so sessionImages keys match on reload
      const realId = (data.messageId as string | undefined) ?? optimisticId;
      setMessages((prev) => prev.map((m) =>
        m.id === optimisticId ? { ...m, id: realId, content: data.response as string } : m
      ));

      if (data.voiceStyle)  setVoiceStyles((prev) => ({ ...prev, [realId]: data.voiceStyle as string }));
      if (data.segments)    setMsgSegments((prev) => ({ ...prev, [realId]: data.segments as Segment[] }));
      if (data.world_state) setSession((s) => ({ ...s, world_state: data.world_state as typeof s.world_state }));
      if (data.location)    {
        setCurrentLocation(data.location as string);
        setCurrentLocationName((data.locationName as string | null) ?? null);
        playAmbient(data.location as string, (data.ambientFile as string | null | undefined) ?? null);
      }

      // Server is the source of truth for inventory/stats — just mirror its players.
      if (data.players) {
        setSession((s) => ({ ...s, players: data.players as typeof s.players }));
      }

      if (data.imagePrompt) setDynamicImages((prev) => ({
        ...prev, [realId]: { prompt: data.imagePrompt as string, type: (data.imageType as string) ?? 'scene' },
      }));

      if (data.completionAction === 'complete-session' || data.completionAction === 'finish-evening') {
        await submitCompletion(data.completionAction as CompletionMode, {
          endedEarly: false,
          trigger: 'keeper',
          requireConfirmation: false,
        });
      }

      if (autoVoiceEnabled) {
        speakMsg(realId, data.response as string, data.voiceStyle as string | undefined, data.segments as Segment[] | undefined);
      }
    } catch {
      setMessages((prev) => prev.map((m) =>
        m.id === optimisticId
          ? { ...m, content: 'Помилка зв\'язку. Спробуй ще раз.' }
          : m
      ));
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (sessionIsReadOnly) return;
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function openCompletionModal(mode: CompletionMode, options?: { endedEarly?: boolean; trigger?: CompletionTrigger }) {
    setStatusError(null);
    setFeedbackRating(5);
    setFeedbackComment('');
    setCompletionRequest({
      mode,
      endedEarly: options?.endedEarly ?? false,
      trigger: options?.trigger ?? 'manual',
    });
  }

  async function submitCompletion(
    mode: CompletionMode,
    options?: {
      endedEarly?: boolean;
      trigger?: CompletionTrigger;
      requireConfirmation?: boolean;
      closeModal?: boolean;
      includeFeedback?: boolean;
    }
  ) {
    if (isUpdatingStatus) return;
    const trigger = options?.trigger ?? 'manual';
    const endedEarly = options?.endedEarly ?? false;
    const requireConfirmation = options?.requireConfirmation ?? true;

    if (options?.includeFeedback && (!Number.isInteger(feedbackRating) || feedbackRating < 1 || feedbackRating > 5)) {
      setStatusError('Оцінка має бути від 1 до 5.');
      return;
    }

    if (requireConfirmation && typeof window !== 'undefined') {
      const confirmText = endedEarly
        ? (mode === 'finish-evening'
            ? 'Достроково завершити цей вечір кампанії та створити наступну сесію?'
            : session.campaign_id
              ? 'Достроково завершити кампанію? Після цього чат лишиться доступним лише для перегляду.'
              : 'Достроково закрити цю сесію? Після цього чат лишиться доступним лише для перегляду.')
        : (mode === 'finish-evening'
            ? 'Кіпер завершує цей вечір кампанії та створює наступну сесію.'
            : session.campaign_id
              ? 'Кіпер завершує кампанію.'
              : 'Кіпер завершує цю сесію.');
      if (!window.confirm(confirmText)) {
        return;
      }
    }

    setStatusError(null);
    setIsUpdatingStatus(true);

    try {
      const response = await fetch(`/api/sessions/${session.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          trigger,
          endedEarly,
          feedback: options?.includeFeedback
            ? { rating: feedbackRating, comment: feedbackComment.trim() || null }
            : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete session');
      }

      const data = await response.json() as CompletionResponse;
      const updatedSession = data.session;

      setSession(updatedSession);
      setCompletionStats(data.stats ?? buildLocalCompletionStats(updatedSession, messages));
      setPendingActions([]);
      setInput('');
      if (options?.closeModal !== false) {
        setCompletionRequest(null);
      }
      upsertReadOnlySessionCache({ ...updatedSession, last_message: lastMessagePreview });

      if (mode === 'finish-evening' && data.nextSession?.id) {
        window.location.href = `/session/${data.nextSession.id}`;
      }
    } catch {
      setStatusError('Не вдалося завершити сесію. Спробуйте ще раз.');
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  const playerName = session.players[activePlayer]?.name || 'Гравець';
  const activePlayerData = session.players[activePlayer];
  const activeInventory = (activePlayerData?.inventory ?? []).filter(item => !item.broken && item.uses !== 0);
  const pendingRoll = session.world_state?.pendingRollResult;

  return (
    <div className="chat-root">
      {/* Left: game column */}
      <div className="chat-main">
        <div className="chat-topbar-shell">
          <div className="chat-topbar-rail">
            <div className="chat-header">
              <div className="chat-header-main">
                <Link
                  href="/sessions"
                  className="chat-back-btn"
                  title="Назад"
                >←</Link>
                <div className="chat-header-copy">
                  <h1 className="chat-session-name">{session.name}</h1>
                  <div className="chat-header-sub">
                    <span className="chat-location">
                      {currentLocationName ?? (currentLocation ? currentLocation.replace(/_/g, ' ') : `Акт ${session.world_state?.act || 1}`)}
                    </span>
                    <span className={`chat-status-badge chat-status-badge--${session.status ?? 'active'}`}>
                      {statusMeta.badge}
                    </span>
                    {session.campaign_id && (
                      <span className="chat-status-badge chat-status-badge--chapter">
                        Сесія {session.session_number || 1}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="chat-header-actions">
                {speakingId && (
                  <button
                    onClick={stopAudio}
                    className="chat-icon-btn"
                    title="Зупинити"
                  >⏹</button>
                )}
                <button
                  onClick={() => setShowSidebar((v) => !v)}
                  className="chat-icon-btn chat-mobile-only"
                  title="Матеріали справи"
                >📋</button>
                <button
                  onClick={() => setShowSettings((v) => !v)}
                  className={`chat-icon-btn${showSettings ? ' chat-icon-btn--active' : ''}`}
                  title="Налаштування звуку"
                >⚙️</button>
              </div>
            </div>

            {showSettings && (
              <div className="chat-settings-panel">
                <div className="chat-segmented-control">
                  {(['passive', 'balanced', 'active'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => changeKeeperStyle(s)}
                      title={
                        s === 'passive'  ? 'Кіпер чекає дій гравців' :
                        s === 'balanced' ? 'Кіпер підказує при пасивності (3+ ходи)' :
                        'Кіпер активно підштовхує сюжет'
                      }
                      className={`chat-segmented-option${keeperStyle === s ? ' is-active' : ''}`}
                    >
                      {s === 'passive' ? 'Пасив' : s === 'balanced' ? 'Баланс' : 'Актив'}
                    </button>
                  ))}
                </div>

                <div className="chat-settings-divider" />

                <Toggle checked={autoVoiceEnabled} onChange={() => setAutoVoiceEnabled((v) => !v)} label="Автоозвучення" />
                <Toggle checked={ambientEnabled} onChange={() => setAmbientEnabled((v) => !v)} label="Ambient" />
                <Toggle checked={diceMode === 'virtual'} onChange={toggleDiceMode} label="Віртуальні кубики" />

                {isAdmin && (
                  <button
                    onClick={exportChatLog}
                    className="chat-small-btn"
                    title="Export full chat log (markdown, admin)"
                  >
                    ⬇ Export log
                  </button>
                )}
                {ambientEnabled && (
                  <div className="chat-volume-control">
                    <span>🔈</span>
                    <input
                      type="range" min={0} max={1} step={0.05}
                      value={ambientVolume}
                      onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                      className="chat-volume-slider"
                      title="Гучність ambient"
                    />
                    <span>🔊</span>
                  </div>
                )}

                {sessionIsReadOnly && completionStats && (
                  <>
                    <div className="chat-settings-divider chat-settings-divider--desktop" />
                    <div className="chat-settings-copy">
                      <span>{statusMeta.summary}</span>
                      <span className="chat-meta-pill">
                        Повідомлень: {completionStats.messageCount}
                      </span>
                      <span className="chat-meta-pill">
                        Від кіпера: {completionStats.keeperMessageCount}
                      </span>
                      <span className="chat-meta-pill">
                        Тривалість: {completionStats.durationMinutes} хв
                      </span>
                    </div>
                  </>
                )}

                {canManuallyEndSession && (
                  <>
                    <div className="chat-settings-divider chat-settings-divider--desktop" />
                    <div className="chat-warning-panel">
                      <span className="chat-warning-copy">
                        Якщо треба зупинити гру раніше фіналу, сесію можна закрити тут вручну.
                      </span>
                      <button
                        onClick={() => openCompletionModal(session.campaign_id ? 'finish-evening' : 'complete-session', { endedEarly: true })}
                        disabled={isUpdatingStatus || isLoading}
                        className="chat-warning-btn"
                      >
                        {isUpdatingStatus
                          ? 'Завершення...'
                          : (session.campaign_id ? statusMeta.finishLabel : statusMeta.completeLabel)}
                      </button>
                      {session.campaign_id && (
                        <button
                          onClick={() => openCompletionModal('complete-session', { endedEarly: true })}
                          disabled={isUpdatingStatus || isLoading}
                          className="chat-secondary-btn"
                        >
                          {statusMeta.completeLabel}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {statusError && (
              <div className="chat-error-banner">
                {statusError}
              </div>
            )}
          </div>
        </div>

      {debugFor && (
        <div className="chat-modal-backdrop">
          <div className="chat-modal chat-modal--wide">
            <div className="chat-modal-header">
              <div>
                <h2>Keeper message debug</h2>
                <p className="chat-modal-subtitle">msg {debugFor}</p>
              </div>
              <div className="chat-modal-actions">
                {debugData !== null && (
                  <>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
                      }}
                      className="chat-small-btn"
                    >
                      Copy JSON
                    </button>
                    <button
                      onClick={downloadDebug}
                      className="chat-small-btn"
                    >
                      ⬇ .json
                    </button>
                  </>
                )}
                <button
                  onClick={closeDebug}
                  className="chat-small-btn"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="chat-modal-body chat-modal-body--mono">
              {debugError && <p className="chat-accent-copy">{debugError}</p>}
              {!debugError && debugData === null && <p className="chat-muted-copy">Loading…</p>}
              {!debugError && debugData !== null && (
                <pre>
                  {JSON.stringify(debugData, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {completionRequest && (
        <div className="chat-modal-backdrop chat-modal-backdrop--sheet">
          <div className="chat-modal chat-modal--sheet">
            <div className="chat-modal-header">
              <div>
                <h2>
                  {completionRequest.endedEarly
                    ? (completionRequest.mode === 'finish-evening'
                        ? 'Достроково завершити вечір'
                        : session.campaign_id
                          ? 'Достроково завершити кампанію'
                          : 'Достроково закрити сесію')
                    : (session.campaign_id ? 'Завершити кампанію' : 'Завершити сесію')}
                </h2>
                <p className="chat-modal-copy">
                  {completionRequest.endedEarly
                    ? 'Сесія завершиться вручну раніше природного фіналу. За бажанням можна лишити оцінку та короткий коментар.'
                    : 'Кіпер завершить історію, а сесія залишиться доступною лише для перегляду. Перед завершенням можна лишити оцінку та короткий коментар.'}
                </p>
              </div>
              <button
                onClick={() => setCompletionRequest(null)}
                className="chat-small-btn"
              >
                ✕
              </button>
            </div>

            <div className="chat-form-block">
              <p className="chat-field-label">Оцінка гри</p>
              <div className="chat-rating-row">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    onClick={() => setFeedbackRating(value)}
                    className={`chat-rating-btn${feedbackRating === value ? ' is-active' : ''}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="chat-form-block">
              <label htmlFor="session-feedback" className="chat-field-label">
                Коментар для покращення
              </label>
              <textarea
                id="session-feedback"
                value={feedbackComment}
                onChange={(event) => setFeedbackComment(event.target.value)}
                rows={4}
                placeholder="Що сподобалось, а що варто підкрутити?"
                className="chat-modal-textarea"
              />
            </div>

            <div className="chat-modal-footer">
              <button
                onClick={() => setCompletionRequest(null)}
                className="chat-secondary-btn chat-secondary-btn--large"
              >
                Ще не зараз
              </button>
              <button
                onClick={() => submitCompletion(completionRequest.mode, {
                  endedEarly: completionRequest.endedEarly,
                  trigger: completionRequest.trigger,
                  includeFeedback: true,
                })}
                disabled={isUpdatingStatus}
                className="chat-primary-btn chat-primary-btn--large"
              >
                {isUpdatingStatus
                  ? 'Завершення...'
                  : (completionRequest.endedEarly ? 'Закрити зараз' : 'Подякувати й завершити')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="chat-transcript-shell">
        <div className="chat-transcript-rail">
          <div className="chat-messages">
            {messages.length === 0 && !isLoading && (
              <div className="chat-empty-state">
                <p className="chat-empty-glyph">📜</p>
                <p className="chat-empty-text">Гра починається...</p>
              </div>
            )}

            {messages.map((msg) => {
              const isUser     = msg.role === 'user';
              const player     = isUser && msg.player_idx !== null ? session.players[msg.player_idx] : null;
              const isPlaying  = speakingId === msg.id;
              const isLoadingA = loadingAudioIds.has(msg.id);

              const imageTagMatch = !isUser ? msg.content.match(/\[IMAGE:(\w+):([^\]]+)\]/) : null;
              const displayContent = stripNpcTags(
                imageTagMatch
                  ? msg.content.replace(/\s*\[IMAGE:\w+:[^\]]+\]/g, '').trim()
                  : msg.content
              );
              const imgMeta = imageTagMatch
                ? { type: imageTagMatch[1], prompt: imageTagMatch[2] }
                : (!isUser ? dynamicImages[msg.id] : undefined);

              const replayBtn = (
                <span className="chat-bubble-actions">
                  <button
                    onClick={() => handleReplay(msg.id, displayContent)}
                    disabled={isLoadingA}
                    className={`chat-replay-btn${isPlaying ? ' chat-replay-btn--playing' : ''}${isLoadingA ? ' chat-replay-btn--loading' : ''}`}
                  >
                    {isPlaying ? '⏸ зупинити' : isLoadingA ? '⏳' : '↻ озвучити'}
                  </button>
                  {isAdmin && !isUser && (
                    <button
                      onClick={() => openDebug(msg.id)}
                      className="chat-debug-btn"
                      title="Show LLM prompt + raw output (admin)"
                    >
                      🐛 debug
                    </button>
                  )}
                </span>
              );

              if (isUser) {
                return (
                  <div key={msg.id} className="chat-msg-row chat-msg-row--user">
                    <div className="chat-bubble-wrap chat-bubble-wrap--user">
                      {player && <p className="chat-bubble-label chat-bubble-label--right">{player.name}</p>}
                      <div className="chat-bubble--user">
                        {displayContent}
                      </div>
                    </div>
                  </div>
                );
              }

              const segs = msgSegments[msg.id];
              const splitBubbles = segs && hasNpcSpeech(segs);

              if (splitBubbles) {
                return (
                  <div key={msg.id} className="chat-msg-group">
                    {segs.map((seg, si) => {
                      const isLast = si === segs.length - 1;
                      if (seg.type === 'narration') {
                        return (
                          <div key={si} className="chat-msg-row">
                            <div className="chat-bubble-wrap">
                              {si === 0 && <p className="chat-bubble-label">Кіпер</p>}
                              <div className="chat-bubble--keeper">
                                {renderText(seg.text)}
                                {isLast && imgMeta && <DynamicImage prompt={imgMeta.prompt} type={imgMeta.type} sessionId={session.id} msgId={msg.id} url={session.world_state.sessionImages?.[msg.id]} onUrlGenerated={handleUrlGenerated} />}
                              </div>
                              {isLast && replayBtn}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={si} className="chat-msg-row chat-msg-row--npc">
                          <div className="chat-bubble-wrap">
                            <p className="chat-bubble-label chat-bubble-label--npc">{seg.name}</p>
                            <div className="chat-bubble--npc">
                              {renderText(seg.text)}
                              {isLast && imgMeta && <DynamicImage prompt={imgMeta.prompt} type={imgMeta.type} sessionId={session.id} msgId={msg.id} url={session.world_state.sessionImages?.[msg.id]} onUrlGenerated={handleUrlGenerated} />}
                            </div>
                            {isLast && replayBtn}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              return (
                <div key={msg.id} className="chat-msg-row">
                  <div className="chat-bubble-wrap">
                    <p className="chat-bubble-label">Кіпер</p>
                    <div className="chat-bubble--keeper">
                      {renderText(displayContent)}
                      {imgMeta && <DynamicImage prompt={imgMeta.prompt} type={imgMeta.type} sessionId={session.id} msgId={msg.id} url={session.world_state.sessionImages?.[msg.id]} onUrlGenerated={handleUrlGenerated} />}
                    </div>
                    {replayBtn}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="chat-msg-row">
                <div className="chat-loading-bubble">
                  <div className="chat-loading-dots">
                    <span className="chat-loading-dot" />
                    <span className="chat-loading-dot" />
                    <span className="chat-loading-dot" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {sessionIsReadOnly ? (
        <div className="chat-control-shell">
          <div className="chat-control-rail">
            <div className="chat-readonly-zone">
              <div className="chat-readonly-card">
                <p className="chat-readonly-title">
                  {session.status === 'paused' ? 'Сесія тимчасово закрита для нових ходів' : 'Чат збережено для перегляду'}
                </p>
                <p className="chat-readonly-text">
                  Ви можете перечитувати переписку, слухати озвучення та переглядати матеріали справи. Нові дії та репліки вимкнено.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="chat-control-shell">
          <div className="chat-control-rail">
            <div className="chat-control-deck">
              <div className="chat-control-meta">
                <div className="chat-control-chip chat-control-chip--active">
                  <span className="chat-control-chip-label">Говорить</span>
                  <strong>{playerName}</strong>
                  {activePlayerData?.role && <span>{activePlayerData.role}</span>}
                </div>
                {session.players.length > 1 && (
                  <div className="chat-control-chip">
                    <span className="chat-control-chip-label">Черга</span>
                    <strong>{pendingActions.length}</strong>
                    <span>{pendingActions.length === 0 ? 'порожньо' : 'ходів очікує'}</span>
                  </div>
                )}
                {activeInventory.length > 0 && (
                  <div className="chat-control-chip">
                    <span className="chat-control-chip-label">Під рукою</span>
                    <strong>{activeInventory.length}</strong>
                    <span>активних предметів</span>
                  </div>
                )}
                {pendingRoll && (
                  <div className="chat-control-chip chat-control-chip--alert">
                    <span className="chat-control-chip-label">Кидок</span>
                    <strong>{pendingRoll.skillName}</strong>
                    <span>ціль: {pendingRoll.goodThreshold}</span>
                  </div>
                )}
              </div>

              {session.players.length > 1 && (
                <div className="chat-player-selector">
                  {session.players.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setActivePlayer(i)}
                      className={`chat-player-btn${activePlayer === i ? ' chat-player-btn--active' : ''}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}

              {pendingActions.length > 0 && (
                <div className="chat-pending-strip">
                  {pendingActions.map((a, i) => (
                    <span
                      key={i}
                      className="chat-pending-pill"
                    >
                      <span className="chat-pending-pill-name">{session.players[a.playerIdx]?.name}</span>
                      <span className="chat-pending-pill-text">{a.text}</span>
                      <button
                        onClick={() => removePending(i)}
                        className="chat-pending-pill-remove"
                      >✕</button>
                    </span>
                  ))}
                </div>
              )}

              {activeInventory.length > 0 && (
                <div className="chat-inventory-strip">
                  {activeInventory.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleUseItem(activePlayer, item.id, item.name)}
                      title={item.description}
                      className="chat-inventory-item"
                    >
                      {item.equipped ? '⚔' : '📦'} {item.name}
                      {item.uses > 0 && <span className="chat-inventory-uses">×{item.uses}</span>}
                      {item.uses === -1 && <span className="chat-inventory-uses">∞</span>}
                    </button>
                  ))}
                </div>
              )}

              {pendingRoll && diceMode === 'virtual' && (
                <DiceRoller
                  key={`${pendingRoll.skillName}-${pendingRoll.goodThreshold}-${pendingRoll.characterIdx}`}
                  pendingRoll={pendingRoll}
                  onResult={(result) => {
                    setSession((s) => ({
                      ...s,
                      world_state: { ...s.world_state, pendingRollResult: undefined },
                    }));
                    sendMessage(result.toString());
                  }}
                />
              )}

              {pendingRoll && diceMode === 'physical' && (
                <div className="chat-dice-hint">
                  <span className="chat-dice-hint-icon">🎲</span>
                  <span>
                    <span className="chat-dice-hint-skill">{pendingRoll.skillName}</span>
                    {' — кинь ≤ '}
                    <span className="chat-dice-hint-value">{pendingRoll.goodThreshold}</span>
                    {' і введи результат'}
                  </span>
                </div>
              )}

              <div className="chat-input-zone">
                <div className="chat-input-row">
                  <div className="chat-input-wrap">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={`${playerName}: дія або слова...`}
                      rows={2}
                      className="chat-textarea"
                      style={{ fontSize: 16 }}
                      disabled={isLoading}
                    />
                    <p className="chat-input-helper">
                      `Enter` — надіслати · `Shift+Enter` — новий рядок
                    </p>
                  </div>
                  <div className="chat-input-actions">
                    <VoiceButton onTranscript={(t) => sendMessage(t)} disabled={isLoading} sessionId={session.id} />
                    {session.players.length > 1 && (
                      <button
                        onClick={queueAction}
                        disabled={isLoading || !input.trim()}
                        title="Додати в чергу (наступний гравець)"
                        className="chat-queue-btn"
                      >+</button>
                    )}
                    <button
                      onClick={() => sendMessage()}
                      disabled={isLoading || (!input.trim() && pendingActions.length === 0)}
                      className="chat-send-btn"
                    >➤</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>{/* end game column */}

      {/* Right: case files panel — always visible on desktop, full-screen overlay on mobile */}
      <div className={`chat-sidebar-shell${showSidebar ? ' is-open' : ''}`}>
        <CaseFilesPanel
          scenarioId={session.scenario_id}
          rulesetId={rulesetId}
          players={session.players}
          briefing={briefing}
          npcs={scenarioNpcs}
          npcRelations={session.world_state?.npcRelations ?? {}}
          npcDetails={session.world_state?.npcDetails}
          dynamicNpcs={session.world_state?.dynamicNpcs}
          dynamicImages={dynamicImages}
          sessionImages={session.world_state.sessionImages}
          onUrlGenerated={handleUrlGenerated}
          sessionId={session.id}
          onClose={() => setShowSidebar(false)}
        />
      </div>
    </div>
  );
}
