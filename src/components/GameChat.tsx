'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useState, useEffect, useRef } from 'react';
import type { CasePlan, CasePlanItem, GameSession, Message, Player, ScenarioBriefing, NPC } from '@/types';
import type { Segment } from '@/lib/segments';
import { hasNpcSpeech, parseSegments, stripNpcTags, stripStreamingArtifacts } from '@/lib/segments';
import { resolvePlayerStats } from '@/lib/statUtils';
import type { AiProvider } from '@/app/api/ai/route';
import VoiceButton from './VoiceButton';
import DiceRoller from './DiceRoller';
import StatsBar from './StatsBar';

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
      badgeClass: 'border-emerald-800/70 bg-emerald-950/60 text-emerald-200',
    };
  }

  if (session.status === 'paused') {
    return {
      isReadOnly: true,
      badge: isCampaign ? 'Кампанію поставлено на паузу' : 'Сесію поставлено на паузу',
      summary: 'Нові ходи тимчасово вимкнено. Поточну історію можна спокійно переглядати.',
      completeLabel: '',
      finishLabel: '',
      badgeClass: 'border-amber-800/70 bg-amber-950/60 text-amber-200',
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
    badgeClass: 'border-stone-700 bg-stone-800 text-stone-300',
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
      className="flex items-center gap-2 px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-stone-300 transition-colors"
      title={`${checked ? 'Вимкнути' : 'Увімкнути'} ${label}`}
    >
      <span className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-green-600' : 'bg-stone-600'}`}>
        <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ${checked ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
      </span>
      <span className="text-xs">{label}</span>
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
      <div className="mt-2 rounded-xl bg-stone-800 border border-stone-700 flex flex-col items-center justify-center gap-2 py-4" style={{ minHeight: 120 }}>
        <span className="text-stone-400 text-xs">Не вдалося згенерувати зображення</span>
        <button
          type="button"
          onClick={() => { fetched.current = true; doFetch(); }}
          disabled={loading}
          className="text-xs px-3 py-1 rounded bg-stone-700 hover:bg-stone-600 text-stone-200 disabled:opacity-50"
        >
          {loading ? 'Спроба…' : '↻ Спробувати ще раз'}
        </button>
      </div>
    );
  }

  if (!resolvedSrc) {
    return (
      <div className="chat-evidence-loading mt-2" style={{ height: 160 }}>
        <span className="chat-evidence-loading__label">Проявляється світлина…</span>
      </div>
    );
  }

  return (
    <>
      <img
        src={resolvedSrc}
        alt=""
        onClick={() => setFullscreen(true)}
        className="mt-2 rounded-xl object-contain cursor-zoom-in border border-stone-600"
        style={{ maxWidth: 320, maxHeight: 320 }}
      />
      {fullscreen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFullscreen(false)}
        >
          <img src={resolvedSrc} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>,
        document.body
      )}
    </>
  );
}

// Bold-text renderer: **text** → <strong>
// ANT-130: only complete pairs convert, so a half-streamed or
// truncation-orphaned marker would render as literal asterisks — drop a
// lone `*` at the buffer edge, then remove the last `**` if unpaired.
function renderText(text: string) {
  text = text.replace(/(^|[^*])\*$/, '$1');
  const markers = text.match(/\*\*/g);
  if (markers && markers.length % 2 === 1) {
    const i = text.lastIndexOf('**');
    text = text.slice(0, i) + text.slice(i + 2);
  }
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
  activePlayer,
  onSelectPlayer,
  onUseItem,
  readOnly,
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
  statusLabel,
  currentLocationName,
  casePlan,
  counts,
}: {
  scenarioId: string;
  rulesetId: string;
  players: Player[];
  activePlayer: number;
  onSelectPlayer: (idx: number) => void;
  onUseItem: (playerIdx: number, itemId: string, itemName: string) => void;
  readOnly: boolean;
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
  statusLabel: string;
  currentLocationName?: string | null;
  casePlan?: CasePlan;
  counts: { evidence: number; npcs: number; locations: number; plan: number };
}) {
  const [images, setImages]     = useState<{ id: string; url: string; label: string }[]>([]);
  const [imagesScenarioId, setImagesScenarioId] = useState<string | null>(null);
  const [imagesRequested, setImagesRequested] = useState(false);
  const [fullscreen, setFullscreen] = useState<string | null>(null);
  const loadingImgs = imagesRequested && imagesScenarioId !== scenarioId;
  const visibleImages = imagesScenarioId === scenarioId ? images : [];

  // Lazily fetch static scenario images the first time the Матеріали section opens.
  useEffect(() => {
    if (!imagesRequested || imagesScenarioId === scenarioId) return;
    fetch(`/api/scenarios/${scenarioId}/images`)
      .then((r) => r.json())
      .then((d) => { setImages(d.images ?? []); setImagesScenarioId(scenarioId); })
      .catch(() => { setImages([]); setImagesScenarioId(scenarioId); });
  }, [imagesRequested, imagesScenarioId, scenarioId]);

  const metNpcs = npcs.filter((n) => n.id in npcRelations);
  const allNpcs: { id: string; name: string; description?: string; isDynamic?: boolean }[] = [
    ...metNpcs.map((n) => ({ id: n.id, name: n.name, description: n.description })),
    ...(dynamicNpcs ?? []).filter((d) => !(metNpcs.some((n) => n.id === d.id))).map((d) => ({ ...d, isDynamic: true })),
  ];
  const planItems = (casePlan?.items ?? []).filter((item) => item.status !== 'hidden');

  const fullscreenOverlay = fullscreen && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFullscreen(null)}
        >
          <img src={fullscreen} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>,
        document.body
      )
    : null;

  const relMeta = (relation: string | undefined) => {
    switch (relation) {
      case 'friendly': return { mod: 'friendly', label: 'Дружній' };
      case 'hostile':  return { mod: 'hostile',  label: 'Ворожий' };
      case 'neutral':  return { mod: 'neutral',  label: 'Нейтральний' };
      default:         return { mod: 'unknown',  label: 'Невідомо' };
    }
  };

  const planMeta = (item: CasePlanItem) => {
    switch (item.status) {
      case 'completed': return { label: 'Виконано', mod: 'completed' };
      case 'crossed_out': return { label: 'Закреслено', mod: 'crossed' };
      default: return { label: 'Активно', mod: 'available' };
    }
  };

  return (
    <>
      <div className="chat-dossier">
        {/* Header */}
        <div className="chat-dossier__hdr">
          <span className="chat-dossier__kicker">Досьє справи</span>
          {onClose && (
            <button onClick={onClose} className="chat-dossier__close" title="Згорнути" aria-label="Згорнути панель">✕</button>
          )}
        </div>

        {/* Persistent summary — visible at a glance, no tab switching */}
        <div className="chat-dossier__summary">
          <span className={`chat-dossier__status chat-dossier__status--${statusLabel === 'Завершено' ? 'done' : statusLabel === 'Пауза' ? 'paused' : 'active'}`}>
            {statusLabel}
          </span>
          {currentLocationName && (
            <p className="chat-dossier__loc"><span aria-hidden>📍</span> {currentLocationName}</p>
          )}
          {briefing?.objective && (
            <p className="chat-dossier__objective">{briefing.objective}</p>
          )}
          <div className="chat-dossier__counts">
            <span><b>{counts.evidence}</b> матеріалів</span>
            <span><b>{counts.npcs}</b> персонажів</span>
            <span><b>{counts.locations}</b> локацій</span>
          </div>
        </div>

        {/* Character stats (HP / SAN / Luck + inventory) — moved here from the
            central chat column so the reading area stays uncluttered (ANT-166). */}
        <div className="chat-dossier__stats">
          <StatsBar
            players={players}
            activePlayer={activePlayer}
            onSelectPlayer={onSelectPlayer}
            rulesetId={rulesetId}
            onUseItem={onUseItem}
            readOnly={readOnly}
          />
        </div>

        {/* Collapsible sections (native <details>) instead of mutually-exclusive tabs */}
        <div className="chat-dossier__sections">

          {planItems.length > 0 && (
            <details className="chat-dossier__sec" open>
              <summary>План справи ({planItems.length})</summary>
              <ol className="chat-case-plan" aria-label="План справи">
                {planItems.map((item) => {
                  const meta = planMeta(item);
                  return (
                    <li key={item.id} className={`chat-case-plan__item chat-case-plan__item--${meta.mod}`}>
                      <span className="chat-case-plan__marker" aria-hidden />
                      <div className="chat-case-plan__copy">
                        <div className="chat-case-plan__line">
                          <span className="chat-case-plan__label">{item.label}</span>
                          <span className="chat-case-plan__status">{meta.label}</span>
                        </div>
                        {item.note && <p className="chat-case-plan__note">{item.note}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </details>
          )}

          {/* ── Опис ── */}
          {briefing && (
            <details className="chat-dossier__sec" open>
              <summary>Опис справи</summary>
              <div className="chat-dossier__sec-body space-y-3">
                <div>
                  <p className="chat-dossier__field-label">Обстановка</p>
                  <p className="chat-dossier__field-text">{briefing.setting}</p>
                </div>
                <div>
                  <p className="chat-dossier__field-label">Що сталось</p>
                  <p className="chat-dossier__field-text whitespace-pre-line">{briefing.premise}</p>
                </div>
                <div>
                  <p className="chat-dossier__field-label">Завдання</p>
                  <p className="chat-dossier__field-text">{briefing.objective}</p>
                </div>
              </div>
            </details>
          )}

          {/* ── Гравці ── */}
          <details className="chat-dossier__sec" open>
            <summary>Слідчі ({players.length})</summary>
            <div className="chat-dossier__sec-body space-y-3">
              {players.map((p, i) => (
                <div key={i} className="chat-dossier-card space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-stone-100 truncate">{p.name}</span>
                    <span className="text-xs text-amber-600 shrink-0">{p.role}</span>
                  </div>
                  {p.background && (
                    <p className="text-xs text-stone-400 leading-relaxed">{p.background}</p>
                  )}
                  <div className="flex gap-3 text-xs pt-1 flex-wrap">
                    {resolvePlayerStats(p, rulesetId).map((s) => (
                      <span key={s.id} style={{ color: s.color }}>
                        {s.label} {s.value}{s.hasMax && s.max !== null ? `/${s.max}` : ''}
                      </span>
                    ))}
                  </div>
                  {Object.keys(p.skills).length > 0 && (
                    <div className="border-t border-stone-700/60 pt-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
                      {Object.entries(p.skills).map(([skill, val]) => (
                        <div key={skill} className="flex justify-between">
                          <span className="text-xs text-stone-500 truncate">{skill}</span>
                          <span className="text-xs text-amber-700 font-mono ml-1">{val}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>

          {/* ── Персонажі (NPCs) — relationship stamps ── */}
          <details className="chat-dossier__sec">
            <summary>Персонажі ({allNpcs.length})</summary>
            <div className="chat-dossier__sec-body space-y-3">
              {allNpcs.length === 0 ? (
                <p className="text-xs text-stone-500 text-center py-2">Персонажі ще не зустрічались</p>
              ) : (
                allNpcs.map((npc) => {
                  const rel = relMeta(npcRelations[npc.id]);
                  return (
                    <div key={npc.id} className="chat-dossier-card space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-stone-100 truncate">{npc.name}</span>
                        <span className={`chat-npc-stamp chat-npc-stamp--${rel.mod}`}>{rel.label}</span>
                      </div>
                      {npc.description && (
                        <p className="text-xs text-stone-400 leading-relaxed">{npc.description}</p>
                      )}
                      {npcDetails?.[npc.id]?.notes && (
                        <p className="text-xs text-amber-200/80 leading-relaxed border-t border-stone-700/60 pt-1.5 mt-1">{npcDetails[npc.id].notes}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </details>

          {/* ── Матеріали (evidence cards) ── */}
          <details className="chat-dossier__sec" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) setImagesRequested(true); }}>
            <summary>Матеріали ({counts.evidence})</summary>
            <div className="chat-dossier__sec-body space-y-3">
              {Object.keys(dynamicImages).length > 0 && (
                <div className="space-y-2">
                  <p className="chat-dossier__field-label">Сесійні матеріали</p>
                  {Object.entries(dynamicImages).map(([msgId, meta]) => (
                    <figure key={msgId} className="chat-evidence-card">
                      <DynamicImage prompt={meta.prompt} type={meta.type} sessionId={sessionId} msgId={msgId} url={sessionImages?.[msgId]} onUrlGenerated={onUrlGenerated} />
                      <figcaption className="chat-evidence-card__cap" title={meta.prompt}>
                        {meta.prompt.length > 50 ? meta.prompt.slice(0, 50) + '…' : meta.prompt}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
              {(visibleImages.length > 0 || loadingImgs) && (
                <div className="space-y-2 border-t border-stone-700/50 pt-3">
                  <p className="chat-dossier__field-label">Сценарні матеріали</p>
                  {loadingImgs && <p className="text-xs text-stone-600 text-center py-2">Завантаження…</p>}
                  {visibleImages.map((img) => (
                    <figure key={img.id} className="chat-evidence-card">
                      <img
                        src={img.url}
                        alt={img.label}
                        onClick={() => setFullscreen(img.url)}
                        className="rounded-lg object-contain cursor-zoom-in"
                        style={{ maxWidth: '100%', maxHeight: 200 }}
                      />
                      <figcaption className="chat-evidence-card__cap text-center">{img.label}</figcaption>
                    </figure>
                  ))}
                </div>
              )}
              {Object.keys(dynamicImages).length === 0 && !loadingImgs && visibleImages.length === 0 && (
                <p className="text-xs text-stone-600 text-center py-2">Матеріали ще не зібрано</p>
              )}
            </div>
          </details>

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

export default function GameChat({ session: initialSession, initialMessages, briefing, locationNames = {}, ambientByLocation: initialAmbientByLocation = {}, scenarioNpcs = [], rulesetId = 'coc_7e', defaultAiProvider = 'deepseek-base', defaultTtsProvider = 'gemini', isAdmin = false }: GameChatProps) {
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
  const [physicalRollInput, setPhysicalRollInput] = useState('');
  const [isLoading, setIsLoading]             = useState(false);
  const [speakingId, setSpeakingId]           = useState<string | null>(null);
  const [loadingAudioIds, setLoadingAudioIds] = useState<Set<string>>(new Set());
  const [activePlayer, setActivePlayer]       = useState(0);
  const [showSettings, setShowSettings]       = useState(false);
  const [showSidebar, setShowSidebar]         = useState(false);
  // ANT-102: desktop inspector rail can collapse to an icon-only strip (persisted).
  const [railCollapsed, setRailCollapsed]     = useState(false);
  const [debugFor, setDebugFor]               = useState<string | null>(null);
  const [debugData, setDebugData]             = useState<unknown>(null);
  const [debugError, setDebugError]           = useState<string | null>(null);
  const [pendingActions, setPendingActions]   = useState<{ playerIdx: number; text: string }[]>([]);
  // ANT-129: id of the newest Keeper message that was cut by the token cap —
  // its bubble gets a "continue" affordance until the next exchange.
  const [truncatedMsgId, setTruncatedMsgId]   = useState<string | null>(null);
  // ANT-133: a failed send rolls the exchange back and restores the input;
  // this banner tells the player their text survived and one more ➤ retries.
  const [sendError, setSendError]             = useState(false);
  // ANT-135: message whose voice-over failed — its button shows a transient
  // warning instead of silently reverting to the idle label.
  const [ttsErrorId, setTtsErrorId]           = useState<string | null>(null);
  // ANT-78: for a completed campaign evening, point the player to the next evening.
  const [nextEvening, setNextEvening] = useState<{ id: string; sessionNumber: number } | null>(null);
  const statusMeta = getStatusMeta(session);
  const sessionIsReadOnly = statusMeta.isReadOnly;
  const canManuallyEndSession = !sessionIsReadOnly;
  const pendingRoll = session.world_state?.pendingRollResult;

  // ANT-102: restore persisted desktop rail collapse state.
  useEffect(() => {
    try { setRailCollapsed(localStorage.getItem('barri.railCollapsed') === 'true'); } catch { /* ignore */ }
  }, []);

  // Case-files toggle: mobile opens the drawer, desktop collapses/expands the rail.
  function toggleCaseFiles() {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      setShowSidebar((v) => !v);
    } else {
      setRailCollapsed((v) => {
        const next = !v;
        try { localStorage.setItem('barri.railCollapsed', String(next)); } catch { /* ignore */ }
        return next;
      });
    }
  }

  // ANT-78: when viewing a finished campaign evening, locate the next evening of
  // the same campaign so the read-only screen offers a clear way forward instead
  // of a dead-end disabled chat.
  useEffect(() => {
    if (session.status !== 'completed' || !session.campaign_id) {
      setNextEvening(null);
      return;
    }
    const currentNumber = session.session_number ?? 1;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/sessions');
        if (!res.ok) return;
        const all = (await res.json()) as GameSession[];
        const next = all
          .filter((s) => s.campaign_id === session.campaign_id && (s.session_number ?? 1) > currentNumber)
          .sort((a, b) => (a.session_number ?? 1) - (b.session_number ?? 1))[0];
        if (!cancelled && next) {
          setNextEvening({ id: next.id, sessionNumber: next.session_number ?? currentNumber + 1 });
        }
      } catch {
        // Non-critical affordance — silently skip if the lookup fails.
      }
    })();
    return () => { cancelled = true; };
  }, [session.status, session.campaign_id, session.session_number]);
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
    setPhysicalRollInput('');
  }, [
    pendingRoll?.characterIdx,
    pendingRoll?.skillName,
    pendingRoll?.goodThreshold,
  ]);

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

    const introId = `local-${Date.now()}-intro`;
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

  function submitRollResult(result: number) {
    // ANT-119: attribute the result to the player the roll was set for, not
    // whoever's tab happens to be active — otherwise the Keeper narrates the
    // wrong character.
    const rollIdx = pendingRoll?.characterIdx;
    const asPlayerIdx =
      typeof rollIdx === 'number' && session.players[rollIdx] ? rollIdx : undefined;
    // ANT-134: a bare "62" reads cryptic in history — send a structured roll
    // line instead. The 🎲 prefix is the contract: the server's dice-result
    // detector and the chip styling both key off it.
    const en = session.language === 'en';
    const rollText = pendingRoll
      ? `🎲 ${pendingRoll.skillName}: ${result} ${en ? 'vs' : 'проти'} ${pendingRoll.goodThreshold} — ${
          result <= pendingRoll.goodThreshold ? (en ? 'success' : 'успіх') : (en ? 'failure' : 'провал')
        }`
      : result.toString();
    setSession((s) => ({
      ...s,
      world_state: { ...s.world_state, pendingRollResult: undefined },
    }));
    setPhysicalRollInput('');
    sendMessage(rollText, asPlayerIdx);
  }

  function submitPhysicalRoll() {
    const result = Number(physicalRollInput);
    if (!pendingRoll || !Number.isInteger(result) || result < 1 || result > 100) return;
    submitRollResult(result);
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
      if (!fallbackTTS(text)) flagTtsError(msgId);
    } finally {
      setLoadingAudioIds((prev) => { const s = new Set(prev); s.delete(msgId); return s; });
    }
  }

  // ANT-135: surface playback failures on the button itself for a few seconds.
  function flagTtsError(msgId: string) {
    setTtsErrorId(msgId);
    window.setTimeout(() => setTtsErrorId((cur) => (cur === msgId ? null : cur)), 4000);
  }

  function playUrl(msgId: string, url: string) {
    const audio = new Audio(url);
    audioRef.current = audio;
    setSpeakingId(msgId);
    audio.onended = () => setSpeakingId(null);
    audio.onerror = () => { setSpeakingId(null); flagTtsError(msgId); };
    audio.play().catch(() => { setSpeakingId(null); flagTtsError(msgId); });
  }

  function fallbackTTS(text: string): boolean {
    if (!window.speechSynthesis) return false;
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'uk-UA'; utt.rate = 0.85; utt.pitch = 0.9;
    utt.onend = () => setSpeakingId(null);
    window.speechSynthesis.speak(utt);
    return true;
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

  async function sendMessage(text?: string, asPlayerIdx?: number) {
    if (sessionIsReadOnly) return;
    const immediate = (text || input).trim();

    // Build full action list
    const allActions = immediate
      ? [...pendingActions, { playerIdx: asPlayerIdx ?? activePlayer, text: immediate }]
      : [...pendingActions];

    if (allActions.length === 0 || isLoading) return;

    setInput('');
    setPendingActions([]);
    setSendError(false);
    setIsLoading(true);

    // Build combined message for AI
    const combinedMessage = allActions.length === 1
      ? allActions[0].text  // API route adds [Name]: prefix itself
      : allActions.map((a) => {
          const name = session.players[a.playerIdx]?.name;
          return name ? `[${name}]: ${a.text}` : a.text;
        }).join('\n');

    // Show each action as individual bubble in chat.
    // ANT-122: namespaced local ids — `now + i` for user bubbles collided with
    // the assistant id (`Date.now() + 1`) when 2+ queued actions landed in the
    // same millisecond, so stream chunks were appended into a player's bubble.
    const now = Date.now();
    const newUserMsgs: Message[] = allActions.map((a, i) => ({
      id: `local-${now}-u${i}`,
      session_id: session.id,
      role: 'user',
      content: a.text,
      player_idx: a.playerIdx,
      created_at: new Date().toISOString(),
    }));
    setMessages((prev) => [...prev, ...newUserMsgs]);

    // Optimistic assistant bubble — shows streaming text as it arrives
    const optimisticId = `local-${now}-a`;
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
        }),
      });
      // Access-gate responses (ANT-108) carry a user-facing message: waiting-list
      // (403 not_approved) or daily cost cap (429 daily_limit_reached). Surface it
      // in the bubble instead of the generic connection error.
      if (res.status === 403 || res.status === 429) {
        let msg = res.status === 429
          ? 'Денний ліміт вичерпано. Повертайтесь завтра.'
          : 'Доступ обмежено.';
        try {
          const errData = await res.json();
          if (errData?.message) msg = errData.message as string;
        } catch { /* keep fallback */ }
        setMessages((prev) => prev.map((m) => (m.id === optimisticId ? { ...m, content: msg } : m)));
        return;
      }
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
      setTruncatedMsgId(data.truncated ? realId : null);

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

      // ANT-77: the Keeper emitting [FINISH_EVENING]/[COMPLETE_SESSION] must NOT
      // silently close the session. Open the confirmation modal so the player
      // explicitly confirms (and can leave feedback) before anything is finalized.
      if (data.completionAction === 'complete-session' || data.completionAction === 'finish-evening') {
        openCompletionModal(data.completionAction as CompletionMode, { trigger: 'keeper' });
      }

      if (autoVoiceEnabled) {
        speakMsg(realId, data.response as string, data.voiceStyle as string | undefined, data.segments as Segment[] | undefined);
      }
    } catch {
      // ANT-133: don't leave a dead error bubble the player can't act on —
      // roll the failed exchange back out of the chat, restore the typed text
      // and queued actions, and show a banner so one more ➤ retries it.
      setMessages((prev) => prev.filter(
        (m) => m.id !== optimisticId && !newUserMsgs.some((u) => u.id === m.id)
      ));
      if (immediate) {
        setPendingActions(allActions.slice(0, -1));
        setInput(immediate);
      } else {
        setPendingActions(allActions);
      }
      setSendError(true);
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

      // Any campaign completion (an evening or the whole campaign) returns the
      // player to the case list, where the campaign now shows its next active
      // evening to continue. One-shot completion stays on the read-only chat.
      if (session.campaign_id && (mode === 'finish-evening' || mode === 'complete-session')) {
        window.location.href = '/sessions';
      }
    } catch {
      setStatusError('Не вдалося завершити сесію. Спробуйте ще раз.');
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  const playerName = session.players[activePlayer]?.name || 'Гравець';

  const statusBadgeMod =
    session.status === 'completed' ? 'completed' :
    session.status === 'paused'    ? 'paused'    : 'active';

  return (
    <div className="chat-root">
      {/* Left: game column */}
      <div className="chat-game-column">
      {/* Header */}
      <div className="chat-header flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/sessions" className="chat-back-btn" title="Назад">←</Link>
          <div className="min-w-0">
            <h1 className="chat-session-name truncate">{session.name}</h1>
            <div className="chat-header-sub">
              <span className="chat-location truncate">
                {currentLocationName ?? (currentLocation ? currentLocation.replace(/_/g, ' ') : `Акт ${session.world_state?.act || 1}`)}
              </span>
              <span className={`chat-status-badge chat-status-badge--${statusBadgeMod}`}>
                {statusMeta.badge}
              </span>
              {session.campaign_id && (
                <span className="chat-status-badge chat-status-badge--active">
                  Сесія {session.session_number || 1}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {speakingId && (
            <button onClick={stopAudio} className="chat-icon-btn" title="Зупинити озвучення" aria-label="Зупинити озвучення">⏹</button>
          )}
          <button
            onClick={toggleCaseFiles}
            className="chat-icon-btn"
            title="Матеріали справи"
            aria-label="Матеріали справи"
          >📋</button>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`chat-icon-btn${showSettings ? ' chat-icon-btn--active' : ''}`}
            title="Налаштування"
            aria-label="Налаштування"
            aria-expanded={showSettings}
          >⚙️</button>
        </div>
      </div>

      {/* Character stats moved to the dossier side panel (ANT-166). */}

      {/* Collapsible settings panel */}
      {showSettings && (
        <div className="chat-settings-panel flex flex-wrap items-center gap-2 text-xs">
          {/* KeeperStyle selector */}
          <span className="chat-settings-group-label">Стиль Кіпера</span>
          <div className="chat-settings-keeper-group">
            {(['passive', 'balanced', 'active'] as const).map((s) => (
              <button
                key={s}
                onClick={() => changeKeeperStyle(s)}
                title={
                  s === 'passive'  ? 'Кіпер чекає дій гравців' :
                  s === 'balanced' ? 'Кіпер підказує при пасивності (3+ ходи)' :
                  'Кіпер активно підштовхує сюжет'
                }
                className={`chat-settings-keeper-btn${keeperStyle === s ? ' chat-settings-keeper-btn--active' : ''}`}
              >
                {s === 'passive' ? 'Пасив' : s === 'balanced' ? 'Баланс' : 'Актив'}
              </button>
            ))}
          </div>

          <div className="chat-settings-divider" />

          <span className="chat-settings-group-label">Звук</span>
          <Toggle checked={autoVoiceEnabled} onChange={() => setAutoVoiceEnabled((v) => !v)} label="Автоозвучення" />
          <Toggle checked={ambientEnabled} onChange={() => setAmbientEnabled((v) => !v)} label="Ембієнт" />

          <div className="chat-settings-divider" />

          <span className="chat-settings-group-label">Кубики</span>
          <Toggle checked={diceMode === 'virtual'} onChange={toggleDiceMode} label="Віртуальні" />

          {isAdmin && (
            <button
              onClick={exportChatLog}
              className="chat-settings-aux-btn"
              title="Export full chat log (markdown, admin)"
            >
              ⬇ Export log
            </button>
          )}
          {ambientEnabled && (
            <div className="chat-settings-volume-row">
              <span>🔈</span>
              <input
                type="range" min={0} max={1} step={0.05}
                value={ambientVolume}
                onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                className="w-20"
                title="Гучність ембієнту"
              />
              <span>🔊</span>
            </div>
          )}

          {sessionIsReadOnly && completionStats && (
            <>
              <div className="chat-settings-divider hidden sm:block" />
              <div className="chat-settings-stats">
                <span>{statusMeta.summary}</span>
                <span className="chat-settings-stat-pill">Повідомлень: {completionStats.messageCount}</span>
                <span className="chat-settings-stat-pill">Від кіпера: {completionStats.keeperMessageCount}</span>
                <span className="chat-settings-stat-pill">Тривалість: {completionStats.durationMinutes} хв</span>
              </div>
            </>
          )}

          {canManuallyEndSession && (
            <>
              <div className="chat-settings-divider hidden sm:block" />
              <div className="chat-settings-end-row">
                <span>Якщо треба зупинити гру раніше фіналу, сесію можна закрити тут вручну.</span>
                <button
                  onClick={() => openCompletionModal(session.campaign_id ? 'finish-evening' : 'complete-session', { endedEarly: true })}
                  disabled={isUpdatingStatus || isLoading}
                  // Ending just the evening is the softer action (black); ending a
                  // one-shot session is terminal (red). Ending the whole campaign
                  // is the most final action — that button below is red.
                  className={session.campaign_id ? 'chat-settings-end-btn--secondary' : 'chat-settings-end-btn--primary'}
                >
                  {isUpdatingStatus
                    ? 'Завершення...'
                    : (session.campaign_id ? statusMeta.finishLabel : statusMeta.completeLabel)}
                </button>
                {session.campaign_id && (
                  <button
                    onClick={() => openCompletionModal('complete-session', { endedEarly: true })}
                    disabled={isUpdatingStatus || isLoading}
                    className="chat-settings-end-btn--primary"
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
        <div className="chat-status-error">
          {statusError}
        </div>
      )}

      {debugFor && (
        <div className="fixed inset-0 z-50 flex items-stretch bg-black/80 p-0 sm:items-center sm:justify-center sm:p-4">
          <div className="flex w-full flex-col overflow-hidden rounded-t-2xl border border-stone-700 bg-stone-950 sm:max-h-[85vh] sm:max-w-4xl sm:rounded-2xl">
            <div className="flex items-center justify-between gap-2 border-b border-stone-800 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-stone-100">Keeper message debug</h2>
                <p className="text-[11px] text-stone-500 break-all">msg {debugFor}</p>
              </div>
              <div className="flex items-center gap-2">
                {debugData !== null && (
                  <>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
                      }}
                      className="border border-stone-700 bg-stone-800 px-2.5 py-1 text-xs text-stone-200 hover:bg-stone-700"
                    >
                      Copy JSON
                    </button>
                    <button
                      onClick={downloadDebug}
                      className="border border-stone-700 bg-stone-800 px-2.5 py-1 text-xs text-stone-200 hover:bg-stone-700"
                    >
                      ⬇ .json
                    </button>
                  </>
                )}
                <button
                  onClick={closeDebug}
                  className="rounded-lg border border-stone-700 bg-stone-800 px-2.5 py-1 text-xs text-stone-300 hover:bg-stone-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 text-xs text-stone-300">
              {debugError && <p className="text-amber-400">{debugError}</p>}
              {!debugError && debugData === null && <p className="text-stone-500">Loading…</p>}
              {!debugError && debugData !== null && (
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
                  {JSON.stringify(debugData, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {completionRequest && (
        <div className="chat-completion-overlay">
          <div className="chat-completion-card">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="chat-completion-title">
                  {completionRequest.endedEarly
                    ? (completionRequest.mode === 'finish-evening'
                        ? 'Достроково завершити вечір'
                        : session.campaign_id
                          ? 'Достроково завершити кампанію'
                          : 'Достроково закрити сесію')
                    : (session.campaign_id ? 'Завершити кампанію' : 'Завершити сесію')}
                </h2>
                <p className="chat-completion-desc">
                  {completionRequest.endedEarly
                    ? 'Сесія завершиться вручну раніше природного фіналу. За бажанням можна лишити оцінку та короткий коментар.'
                    : 'Кіпер завершить історію, а сесія залишиться доступною лише для перегляду. Перед завершенням можна лишити оцінку та короткий коментар.'}
                </p>
              </div>
              <button
                onClick={() => setCompletionRequest(null)}
                className="chat-settings-aux-btn"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <p className="chat-bubble-label chat-bubble-label--keeper mb-2">Оцінка гри</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    onClick={() => setFeedbackRating(value)}
                    className={`h-10 w-10 border font-semibold text-sm transition-colors ${
                      feedbackRating === value
                        ? 'border-amber-600/70 bg-amber-900/50 text-amber-200'
                        : 'border-stone-700 bg-stone-800/60 text-stone-400 hover:border-stone-600'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label htmlFor="session-feedback" className="chat-bubble-label chat-bubble-label--keeper">
                Коментар для покращення
              </label>
              <textarea
                id="session-feedback"
                value={feedbackComment}
                onChange={(event) => setFeedbackComment(event.target.value)}
                rows={4}
                placeholder="Що сподобалось, а що варто підкрутити?"
                className="chat-textarea mt-2 w-full"
                style={{ fontSize: 14 }}
              />
            </div>

            <button
              onClick={() => submitCompletion(completionRequest.mode, {
                endedEarly: completionRequest.endedEarly,
                trigger: completionRequest.trigger,
                includeFeedback: true,
                // The modal itself is the explicit confirmation step — no extra window.confirm.
                requireConfirmation: false,
              })}
              disabled={isUpdatingStatus}
              className="chat-completion-btn--primary"
            >
              {isUpdatingStatus
                ? 'Завершення...'
                : (completionRequest.endedEarly ? 'Закрити зараз' : 'Подякувати й завершити')}
            </button>
            <button
              onClick={() => setCompletionRequest(null)}
              className="chat-completion-btn--cancel"
            >
              Ще не зараз
            </button>
          </div>
        </div>
      )}

      {/* Messages — ANT-137: role="log" announces new entries to screen
          readers; aria-busy defers announcements while a reply streams */}
      <div className="chat-messages flex-1 overflow-y-auto" role="log" aria-busy={isLoading}>
        {messages.length === 0 && !isLoading && (
          <div className="chat-empty-state">
            <span className="chat-empty-glyph">ꝏ</span>
            <p>Гра починається...</p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isUser     = msg.role === 'user';
          const player     = isUser && msg.player_idx !== null ? session.players[msg.player_idx] : null;
          const isPlaying  = speakingId === msg.id;
          const isLoadingA = loadingAudioIds.has(msg.id);
          const prev       = idx > 0 ? messages[idx - 1] : null;
          // Same-role consecutive turns share a rail label and tighten spacing.
          // For user, also require the same player_idx so different players still get their name shown.
          const sameAsPrev = !!prev && prev.role === msg.role && (
            !isUser || prev.player_idx === msg.player_idx
          );
          // Subtle reveal only on the newest message (ANT-103) — keyed by msg.id
          // so the animation runs once on mount, not on every re-render/stream chunk.
          const isNewest = idx === messages.length - 1;
          const rowClass = `${sameAsPrev ? ' chat-msg--grouped' : ''}${isNewest ? ' chat-msg--reveal' : ''}`;

          // Parse [IMAGE:...] tag (persisted in DB for reconstruction after reload)
          const imageTagMatch = !isUser ? msg.content.match(/\[IMAGE:(\w+):([^\]]+)\]/) : null;
          const baseContent = imageTagMatch
            ? msg.content.replace(/\s*\[IMAGE:\w+:[^\]]+\]/g, '').trim()
            : msg.content;
          // ANT-121: while streaming, the bubble shows raw model output — hide
          // complete data tags and the partial tag at the buffer edge so
          // [DELTA:...] / [CASE_PLAN:...] never flash before the done event.
          const displayContent = stripNpcTags(
            isUser ? baseContent : stripStreamingArtifacts(baseContent)
          );
          const imgMeta = imageTagMatch
            ? { type: imageTagMatch[1], prompt: imageTagMatch[2] }
            : (!isUser ? dynamicImages[msg.id] : undefined);

          // Replay button — shared across all bubbles of the same message
          const replayBtn = (
            <span className="inline-flex items-center gap-2">
              <button
                onClick={() => handleReplay(msg.id, displayContent)}
                disabled={isLoadingA}
                className={`chat-replay-btn${isPlaying ? ' chat-replay-btn--playing' : isLoadingA ? ' chat-replay-btn--loading' : ''}`}
              >
                {isPlaying ? '⏸ зупинити' : isLoadingA ? '⏳' : msg.id === ttsErrorId ? '⚠ не відтворилось' : '▶ озвучити'}
              </button>
              {msg.id === truncatedMsgId && !isLoading && !sessionIsReadOnly && (
                <button
                  onClick={() => sendMessage(session.language === 'en' ? 'Continue.' : 'Продовжуй.')}
                  className="chat-replay-btn"
                  title={session.language === 'en'
                    ? 'The reply was cut short by the length limit — ask the Keeper to continue'
                    : 'Відповідь обірвалась через ліміт довжини — попросити Кіпера продовжити'}
                >
                  {session.language === 'en' ? '⤷ continue' : '⤷ продовжити'}
                </button>
              )}
              {isAdmin && !isUser && (
                <button
                  onClick={() => openDebug(msg.id)}
                  className="chat-replay-btn"
                  title="Show LLM prompt + raw output (admin)"
                >
                  🐛 debug
                </button>
              )}
            </span>
          );

          // ── User message ────────────────────────────────────────────────────
          if (isUser) {
            // ANT-134: dice results arrive as "🎲 Skill: N проти M — verdict"
            // and get a distinct chip look instead of a plain chat bubble.
            const isRoll = displayContent.startsWith('🎲');
            const rollFailed = isRoll && /провал|failure/.test(displayContent);
            return (
              <div key={msg.id} className={`flex justify-end${rowClass}`}>
                <div className="max-w-[85%]">
                  {player && !sameAsPrev && (
                    <p className="chat-bubble-label chat-bubble-label--user">{player.name}</p>
                  )}
                  <div className={`chat-bubble--user${isRoll ? ` chat-bubble--roll${rollFailed ? ' chat-bubble--roll-fail' : ''}` : ''}`}>
                    {displayContent}
                  </div>
                </div>
              </div>
            );
          }

          // ── Assistant message with NPC bubbles ──────────────────────────────
          const segs = msgSegments[msg.id];
          const splitBubbles = segs && hasNpcSpeech(segs);

          if (splitBubbles) {
            // Render each segment as its own bubble; replay button on last
            return (
              <div key={msg.id} className={`space-y-2${rowClass}`}>
                {segs.map((seg, si) => {
                  const isLast = si === segs.length - 1;
                  if (seg.type === 'narration') {
                    return (
                      <div key={si} className="flex justify-start">
                        <div className="max-w-[92%]">
                          {si === 0 && !sameAsPrev && (
                            <p className="chat-bubble-label chat-bubble-label--keeper">Кіпер</p>
                          )}
                          <div className="chat-bubble--keeper">
                            {renderText(seg.text)}
                            {isLast && imgMeta && <DynamicImage prompt={imgMeta.prompt} type={imgMeta.type} sessionId={session.id} msgId={msg.id} url={session.world_state.sessionImages?.[msg.id]} onUrlGenerated={handleUrlGenerated} />}
                          </div>
                          {isLast && replayBtn}
                        </div>
                      </div>
                    );
                  } else {
                    // NPC bubble
                    return (
                      <div key={si} className="flex justify-start pl-4">
                        <div className="max-w-[85%]">
                          <p className="chat-bubble-label chat-bubble-label--npc">{seg.name}</p>
                          <div className="chat-bubble--npc">
                            {renderText(seg.text)}
                            {isLast && imgMeta && <DynamicImage prompt={imgMeta.prompt} type={imgMeta.type} sessionId={session.id} msgId={msg.id} url={session.world_state.sessionImages?.[msg.id]} onUrlGenerated={handleUrlGenerated} />}
                          </div>
                          {isLast && replayBtn}
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            );
          }

          // ── Standard single-bubble assistant message ─────────────────────────
          return (
            <div key={msg.id} className={`flex justify-start${rowClass}`}>
              <div className="max-w-[92%]">
                {!sameAsPrev && (
                  <p className="chat-bubble-label chat-bubble-label--keeper">Кіпер</p>
                )}
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
          <div className="flex justify-start">
            <div className="chat-loading-bubble">
              <div className="chat-loading-dots">
                <span className="chat-loading-dot" style={{ animationDelay: '0ms' }} />
                <span className="chat-loading-dot" style={{ animationDelay: '150ms' }} />
                <span className="chat-loading-dot" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {sessionIsReadOnly ? (
        <div className="chat-readonly-zone">
          <div className="chat-readonly-card">
            <p className="chat-readonly-title">
              {session.status === 'paused'
                ? 'Сесія тимчасово закрита для нових ходів'
                : statusMeta.badge}
            </p>
            <p className="chat-readonly-text">
              {statusMeta.summary} Ви можете перечитувати переписку, слухати озвучення та переглядати матеріали справи.
            </p>
            {session.status === 'completed' && session.campaign_id && (
              <div className="chat-readonly-actions">
                {nextEvening ? (
                  <a href={`/session/${nextEvening.id}`} className="chat-settings-end-btn--primary">
                    Продовжити — Вечір {nextEvening.sessionNumber}
                  </a>
                ) : (
                  <a href="/sessions" className="chat-settings-end-btn--secondary">
                    До списку справ
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={`composer-rail${pendingRoll ? ' composer-rail--roll-locked' : ''}`}>
          {pendingRoll ? (
            <div className="composer-rail__roll-lock">
              {diceMode === 'virtual' ? (
                <DiceRoller
                  key={`${pendingRoll.skillName}-${pendingRoll.goodThreshold}-${pendingRoll.characterIdx}`}
                  pendingRoll={pendingRoll}
                  onResult={submitRollResult}
                />
              ) : (
                <form
                  className="chat-physical-roll"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitPhysicalRoll();
                  }}
                >
                  <div className="chat-physical-roll__brief">
                    <span className="chat-physical-roll__stamp">D100</span>
                    <span className="chat-physical-roll__skill">{pendingRoll.skillName}</span>
                    <span className="chat-physical-roll__target">≤ {pendingRoll.goodThreshold}</span>
                    {pendingRoll.context && (
                      <span className="chat-physical-roll__context">{pendingRoll.context}</span>
                    )}
                  </div>
                  <div className="chat-physical-roll__entry">
                    <label className="chat-physical-roll__label" htmlFor="physical-roll-result">
                      Результат кидка
                    </label>
                    <input
                      id="physical-roll-result"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={100}
                      value={physicalRollInput}
                      onChange={(event) => {
                        setPhysicalRollInput(event.target.value.replace(/[^\d]/g, '').slice(0, 3));
                      }}
                      className="chat-physical-roll__input"
                      placeholder="1-100"
                      disabled={isLoading}
                    />
                    <button
                      type="submit"
                      className="chat-physical-roll__submit"
                      disabled={
                        isLoading ||
                        !Number.isInteger(Number(physicalRollInput)) ||
                        Number(physicalRollInput) < 1 ||
                        Number(physicalRollInput) > 100
                      }
                    >
                      Надіслати результат
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <>
              {/* Meta row: active player marker + multi-player tabs + queued actions */}
              {(session.players.length > 1 || pendingActions.length > 0) && (
                <div className="composer-rail__meta">
                  {session.players.length > 1 && (
                    <div className="composer-rail__players" role="tablist" aria-label="Активний гравець">
                      <span className="composer-rail__label">Хід</span>
                      {session.players.map((p, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setActivePlayer(i)}
                          className={`chat-player-btn${activePlayer === i ? ' chat-player-btn--active' : ''}`}
                          role="tab"
                          aria-selected={activePlayer === i}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {pendingActions.length > 0 && (
                    <div className="composer-rail__queue" aria-label="Черга дій">
                      {pendingActions.map((a, i) => (
                        <span key={i} className="chat-pending-pill">
                          <span className="chat-pending-pill__name">{session.players[a.playerIdx]?.name}</span>
                          <span className="chat-pending-pill__text">{a.text}</span>
                          <button
                            type="button"
                            onClick={() => removePending(i)}
                            className="chat-pending-pill__remove"
                            aria-label="Прибрати з черги"
                          >✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Inventory chips for active player */}
              {(session.players[activePlayer]?.inventory ?? []).filter(item => !item.broken && item.uses !== 0).length > 0 && (
                <div className="composer-rail__inventory chat-inventory-strip" aria-label="Інвентар">
                  {session.players[activePlayer].inventory
                    .filter(item => !item.broken && item.uses !== 0)
                    .map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleUseItem(activePlayer, item.id, item.name)}
                        title={item.description}
                        className="chat-inventory-item"
                      >
                        {item.equipped ? '⚔' : '📦'} {item.name}
                        {item.uses > 0 && <span className="chat-inventory-item__uses">×{item.uses}</span>}
                        {item.uses === -1 && <span className="chat-inventory-item__uses">∞</span>}
                      </button>
                    ))}
                </div>
              )}

              {/* ANT-133: failed send — text was restored, one more ➤ retries */}
              {sendError && (
                <div className="chat-status-error" role="alert">
                  Помилка зв&apos;язку — повідомлення не надіслано. Текст збережено, натисни{' '}
                  <button
                    type="button"
                    onClick={() => sendMessage()}
                    className="underline"
                    style={{ font: 'inherit', color: 'inherit' }}
                  >
                    ↻ повторити
                  </button>
                  {' '}або ➤ ще раз.
                </div>
              )}

              {/* Input row */}
              <div className="composer-rail__input">
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
                </div>
                <div className="composer-rail__actions">
                  <VoiceButton onTranscript={(t) => sendMessage(t)} disabled={isLoading} sessionId={session.id} />
                  {session.players.length > 1 && (
                    <button
                      type="button"
                      onClick={queueAction}
                      disabled={isLoading || !input.trim()}
                      title="Додати в чергу (наступний гравець)"
                      className="chat-icon-btn"
                      aria-label="Додати в чергу"
                    >+</button>
                  )}
                  <button
                    type="button"
                    onClick={() => sendMessage()}
                    disabled={isLoading || (!input.trim() && pendingActions.length === 0)}
                    className="chat-send-btn"
                    aria-label="Надіслати"
                  >➤</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      </div>{/* end game column */}

      {/* Right: case files panel — inspector rail on desktop, bottom sheet on mobile */}
      {showSidebar && (
        <div
          className="chat-sidebar-scrim"
          onClick={() => setShowSidebar(false)}
          aria-hidden
        />
      )}
      <aside className={`chat-sidebar${showSidebar ? ' chat-sidebar--open' : ''}${railCollapsed ? ' chat-sidebar--collapsed' : ''}`}>
        <div className="chat-sidebar__handle" aria-hidden />
        {/* Collapsed desktop strip — click anywhere to expand (CSS hides it unless desktop+collapsed) */}
        <button
          type="button"
          className="chat-rail-strip"
          onClick={() => { setRailCollapsed(false); try { localStorage.setItem('barri.railCollapsed', 'false'); } catch { /* ignore */ } }}
          title="Розгорнути досьє"
          aria-label="Розгорнути досьє справи"
        >
          <span className="chat-rail-strip__chevron" aria-hidden>‹</span>
          <span className="chat-rail-strip__icon" aria-hidden>📋</span>
          <span className="chat-rail-strip__count" title="План">{(session.world_state?.casePlan?.items ?? []).filter((item) => item.status !== 'hidden').length}</span>
          <span className="chat-rail-strip__count" title="Матеріали">{Object.keys(dynamicImages).length}</span>
          <span className="chat-rail-strip__count" title="Персонажі">{Object.keys(session.world_state?.npcRelations ?? {}).length}</span>
          <span className="chat-rail-strip__count" title="Локації">{(session.world_state?.visitedLocations ?? []).length}</span>
        </button>
        <CaseFilesPanel
          scenarioId={session.scenario_id}
          rulesetId={rulesetId}
          players={session.players}
          activePlayer={activePlayer}
          onSelectPlayer={setActivePlayer}
          onUseItem={handleUseItem}
          readOnly={sessionIsReadOnly}
          briefing={briefing}
          npcs={scenarioNpcs}
          npcRelations={session.world_state?.npcRelations ?? {}}
          npcDetails={session.world_state?.npcDetails}
          dynamicNpcs={session.world_state?.dynamicNpcs}
          dynamicImages={dynamicImages}
          sessionImages={session.world_state.sessionImages}
          onUrlGenerated={handleUrlGenerated}
          sessionId={session.id}
          onClose={toggleCaseFiles}
          statusLabel={session.status === 'completed' ? 'Завершено' : session.status === 'paused' ? 'Пауза' : 'Активна'}
          currentLocationName={currentLocationName}
          casePlan={session.world_state?.casePlan}
          counts={{
            evidence: Object.keys(dynamicImages).length,
            npcs: Object.keys(session.world_state?.npcRelations ?? {}).length,
            locations: (session.world_state?.visitedLocations ?? []).length,
            plan: (session.world_state?.casePlan?.items ?? []).filter((item) => item.status !== 'hidden').length,
          }}
        />
      </aside>
    </div>
  );
}
