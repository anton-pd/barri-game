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
      className="flex items-center gap-2 px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 active:bg-stone-600 rounded-lg text-stone-300 transition-colors"
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
      <div className="mt-2 rounded-xl overflow-hidden bg-stone-800 animate-pulse flex items-center justify-center border border-stone-700" style={{ height: 160 }}>
        <span className="text-stone-500 text-xs font-medium uppercase tracking-wide">Генерується зображення...</span>
      </div>
    );
  }

  return (
    <>
      <img
        src={resolvedSrc}
        alt=""
        onClick={() => setFullscreen(true)}
        className="mt-2 rounded-xl w-full object-cover cursor-zoom-in border border-stone-600"
        style={{ maxHeight: 220 }}
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
    { id: 'briefing', label: 'Опис' },
    { id: 'players',  label: 'Гравці' },
    { id: 'images',   label: 'Матеріали' },
    { id: 'npcs',     label: 'Персонажі' },
  ];

  const metNpcs = npcs.filter((n) => n.id in npcRelations);
  const allNpcs: { id: string; name: string; description?: string; isDynamic?: boolean }[] = [
    ...metNpcs.map((n) => ({ id: n.id, name: n.name, description: n.description })),
    ...(dynamicNpcs ?? []).filter((d) => !(metNpcs.some((n) => n.id === d.id))).map((d) => ({ ...d, isDynamic: true })),
  ];

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

  return (
    <>
      <div className="w-full md:w-64 md:shrink-0 flex flex-col border-l border-stone-700 bg-stone-900 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-stone-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-amber-500">Матеріали справи</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-stone-700 hover:bg-stone-600 text-stone-200 transition-colors text-base font-bold"
              title="Закрити"
            >✕</button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-700">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 text-xs py-2 transition-colors ${
                tab === t.id
                  ? 'text-amber-400 border-b-2 border-amber-500 -mb-px bg-stone-800'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Briefing ── */}
          {tab === 'briefing' && (
            <div className="p-4 space-y-4">
              {!briefing ? (
                <p className="text-xs text-stone-500 text-center py-6">Опис відсутній</p>
              ) : (
                <>
                  <div>
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Обстановка</p>
                    <p className="text-xs text-stone-300 leading-relaxed">{briefing.setting}</p>
                  </div>
                  <div className="border-t border-stone-700 pt-3">
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Що сталось</p>
                    <p className="text-xs text-stone-300 leading-relaxed whitespace-pre-line">{briefing.premise}</p>
                  </div>
                  <div className="border-t border-stone-700 pt-3">
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Завдання</p>
                    <p className="text-xs text-stone-300 leading-relaxed">{briefing.objective}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Players ── */}
          {tab === 'players' && (
            <div className="p-3 space-y-4">
              {players.map((p, i) => (
                <div key={i} className="bg-stone-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-stone-100">{p.name}</span>
                    <span className="text-xs text-amber-600">{p.role}</span>
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
                    <div className="border-t border-stone-700 pt-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
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
          )}

          {/* ── Images ── */}
          {tab === 'images' && (
            <div className="p-3 space-y-3">
              {/* Session-generated images */}
              {Object.keys(dynamicImages).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Сесійні матеріали</p>
                  <div className="space-y-2">
                    {Object.entries(dynamicImages).map(([msgId, meta]) => (
                      <div key={msgId}>
                        <DynamicImage prompt={meta.prompt} type={meta.type} sessionId={sessionId} msgId={msgId} url={sessionImages?.[msgId]} onUrlGenerated={onUrlGenerated} />
                        <p className="text-xs text-stone-500 mt-1 truncate" title={meta.prompt}>
                          {meta.prompt.length > 50 ? meta.prompt.slice(0, 50) + '…' : meta.prompt}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Static scenario images */}
              {Object.keys(dynamicImages).length > 0 && (visibleImages.length > 0 || loadingImgs) && (
                <div className="border-t border-stone-800 pt-3">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Сценарні матеріали</p>
                </div>
              )}
              {loadingImgs && (
                <p className="text-xs text-stone-600 text-center py-4">Завантаження...</p>
              )}
              {!loadingImgs && visibleImages.length === 0 && Object.keys(dynamicImages).length === 0 && (
                <p className="text-xs text-stone-600 text-center py-4">Матеріали ще генеруються...</p>
              )}
              {visibleImages.map((img) => (
                <div key={img.id}>
                  <img
                    src={img.url}
                    alt={img.label}
                    onClick={() => setFullscreen(img.url)}
                    className="w-full rounded-lg object-cover cursor-zoom-in border border-stone-700 hover:border-stone-500 transition-colors"
                    style={{ maxHeight: 160 }}
                  />
                  <p className="text-xs text-stone-500 mt-1 text-center">{img.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── NPCs ── */}
          {tab === 'npcs' && (
            <div className="p-3 space-y-3">
              {allNpcs.length === 0 ? (
                <p className="text-xs text-stone-500 text-center py-6">Персонажі ще не зустрічались</p>
              ) : (
                allNpcs.map((npc) => {
                  const relation = npcRelations[npc.id];
                  const relColor =
                    relation === 'friendly' ? 'text-green-400 bg-green-900/30' :
                    relation === 'hostile'  ? 'text-red-400 bg-red-900/30'   :
                    relation === 'neutral'  ? 'text-stone-400 bg-stone-700'  :
                                             'text-amber-400 bg-amber-900/30';
                  const relLabel =
                    relation === 'friendly' ? 'Дружній'    :
                    relation === 'hostile'  ? 'Ворожий'    :
                    relation === 'neutral'  ? 'Нейтральний': 'Невідомо';
                  return (
                    <div key={npc.id} className="bg-stone-800 rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-stone-100 truncate">{npc.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${relColor}`}>{relLabel}</span>
                      </div>
                      {npc.description && (
                        <p className="text-xs text-stone-400 leading-relaxed">{npc.description}</p>
                      )}
                      {npcDetails?.[npc.id]?.notes && (
                        <p className="text-xs text-amber-200/80 leading-relaxed border-t border-stone-700 pt-1.5 mt-1">{npcDetails[npc.id].notes}</p>
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

  // Manual stat override (Keeper / admin). LLM-driven changes flow through
  // [DELTA:] tags and arrive via the SSE done event; this handler is only for
  // direct +/- edits in the StatsBar UI.
  async function handleUpdatePlayers(nextPlayers: Player[]) {
    if (sessionIsReadOnly) return;
    setSession((s) => ({ ...s, players: nextPlayers }));
    try {
      await fetch(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: nextPlayers }),
      });
    } catch (err) {
      console.warn('[StatsBar PATCH] failed:', err);
    }
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

  const statusBadgeMod =
    session.status === 'completed' ? 'completed' :
    session.status === 'paused'    ? 'paused'    : 'active';

  return (
    <div className="chat-root flex h-dvh overflow-hidden">
      {/* Left: game column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
            <button onClick={stopAudio} className="chat-icon-btn" title="Зупинити">⏹</button>
          )}
          <button
            onClick={() => setShowSidebar((v) => !v)}
            className="chat-icon-btn md:hidden"
            title="Матеріали справи"
          >📋</button>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`chat-icon-btn${showSettings ? ' chat-icon-btn--active' : ''}`}
            title="Налаштування"
          >⚙️</button>
        </div>
      </div>

      {/* Persistent character stats (HP / SAN / Luck + inventory) */}
      <StatsBar
        players={session.players}
        activePlayer={activePlayer}
        onSelectPlayer={setActivePlayer}
        rulesetId={rulesetId}
        onUpdatePlayers={handleUpdatePlayers}
        onUseItem={handleUseItem}
        readOnly={sessionIsReadOnly}
      />

      {/* Collapsible settings panel */}
      {showSettings && (
        <div className="chat-settings-panel flex flex-wrap items-center gap-2 text-xs">
          {/* KeeperStyle selector */}
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

          <Toggle checked={autoVoiceEnabled} onChange={() => setAutoVoiceEnabled((v) => !v)} label="Автоозвучення" />
          <Toggle checked={ambientEnabled} onChange={() => setAmbientEnabled((v) => !v)} label="Ambient" />
          <Toggle checked={diceMode === 'virtual'} onChange={toggleDiceMode} label="Віртуальні кубики" />

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
                title="Гучність ambient"
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
                  className="chat-settings-end-btn--primary"
                >
                  {isUpdatingStatus
                    ? 'Завершення...'
                    : (session.campaign_id ? statusMeta.finishLabel : statusMeta.completeLabel)}
                </button>
                {session.campaign_id && (
                  <button
                    onClick={() => openCompletionModal('complete-session', { endedEarly: true })}
                    disabled={isUpdatingStatus || isLoading}
                    className="chat-settings-end-btn--secondary"
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
                      className="rounded-lg border border-stone-700 bg-stone-800 px-2.5 py-1 text-xs text-stone-200 hover:bg-stone-700"
                    >
                      Copy JSON
                    </button>
                    <button
                      onClick={downloadDebug}
                      className="rounded-lg border border-stone-700 bg-stone-800 px-2.5 py-1 text-xs text-stone-200 hover:bg-stone-700"
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
                    className={`h-10 w-10 rounded-lg border font-semibold text-sm transition-colors ${
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

      {/* Messages */}
      <div className="chat-messages flex-1 overflow-y-auto">
        {messages.length === 0 && !isLoading && (
          <div className="chat-empty-state">
            <span className="chat-empty-glyph">ꝏ</span>
            <p>Гра починається...</p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser     = msg.role === 'user';
          const player     = isUser && msg.player_idx !== null ? session.players[msg.player_idx] : null;
          const isPlaying  = speakingId === msg.id;
          const isLoadingA = loadingAudioIds.has(msg.id);

          // Parse [IMAGE:...] tag (persisted in DB for reconstruction after reload)
          const imageTagMatch = !isUser ? msg.content.match(/\[IMAGE:(\w+):([^\]]+)\]/) : null;
          const displayContent = stripNpcTags(
            imageTagMatch
              ? msg.content.replace(/\s*\[IMAGE:\w+:[^\]]+\]/g, '').trim()
              : msg.content
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
                {isPlaying ? '⏸ зупинити' : isLoadingA ? '⏳' : '↻ озвучити'}
              </button>
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
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%]">
                  {player && <p className="chat-bubble-label chat-bubble-label--user">{player.name}</p>}
                  <div className="chat-bubble--user">
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
              <div key={msg.id} className="space-y-2">
                {segs.map((seg, si) => {
                  const isLast = si === segs.length - 1;
                  if (seg.type === 'narration') {
                    return (
                      <div key={si} className="flex justify-start">
                        <div className="max-w-[85%]">
                          {si === 0 && <p className="chat-bubble-label chat-bubble-label--keeper">Кіпер</p>}
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
            <div key={msg.id} className="flex justify-start">
              <div className="max-w-[85%]">
                <p className="chat-bubble-label chat-bubble-label--keeper">Кіпер</p>
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
              {session.status === 'paused' ? 'Сесія тимчасово закрита для нових ходів' : 'Чат збережено для перегляду'}
            </p>
            <p className="chat-readonly-text">
              Ви можете перечитувати переписку, слухати озвучення та переглядати матеріали справи. Нові дії та репліки вимкнено.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Player selector */}
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

          {/* Pending actions queue */}
          {pendingActions.length > 0 && (
            <div className="chat-pending-strip">
              {pendingActions.map((a, i) => (
                <span key={i} className="chat-pending-pill">
                  <span className="chat-pending-pill__name">{session.players[a.playerIdx]?.name}</span>
                  <span className="chat-pending-pill__text">{a.text}</span>
                  <button onClick={() => removePending(i)} className="chat-pending-pill__remove">✕</button>
                </span>
              ))}
            </div>
          )}

          {/* Inventory strip — active player's usable items */}
          {(session.players[activePlayer]?.inventory ?? []).filter(item => !item.broken && item.uses !== 0).length > 0 && (
            <div className="chat-inventory-strip">
              {session.players[activePlayer].inventory
                .filter(item => !item.broken && item.uses !== 0)
                .map(item => (
                  <button
                    key={item.id}
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

          {/* Dice roller — virtual mode */}
          {session.world_state?.pendingRollResult && diceMode === 'virtual' && (
            <DiceRoller
              key={`${session.world_state.pendingRollResult.skillName}-${session.world_state.pendingRollResult.goodThreshold}-${session.world_state.pendingRollResult.characterIdx}`}
              pendingRoll={session.world_state.pendingRollResult}
              onResult={(result) => {
                // Optimistically hide dice before LLM responds with [CLEAR_PENDING_ROLL]
                setSession((s) => ({
                  ...s,
                  world_state: { ...s.world_state, pendingRollResult: undefined },
                }));
                sendMessage(result.toString());
              }}
            />
          )}

          {/* Physical dice hint */}
          {session.world_state?.pendingRollResult && diceMode === 'physical' && (
            <div className="chat-dice-hint">
              <span className="text-lg">🎲</span>
              <span>
                <span className="chat-dice-hint__skill">{session.world_state.pendingRollResult.skillName}</span>
                {' — кинь ≤ '}
                <span className="chat-dice-hint__threshold">{session.world_state.pendingRollResult.goodThreshold}</span>
                {' і введи результат'}
              </span>
            </div>
          )}

          {/* Input */}
          <div className="chat-input-zone">
            <div className="flex gap-2 items-end">
              <div className="chat-input-wrap flex-1">
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
              <div className="flex flex-col gap-1.5">
                <VoiceButton onTranscript={(t) => sendMessage(t)} disabled={isLoading} sessionId={session.id} />
                {session.players.length > 1 && (
                  <button
                    onClick={queueAction}
                    disabled={isLoading || !input.trim()}
                    title="Додати в чергу (наступний гравець)"
                    className="chat-icon-btn"
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
        </>
      )}

      </div>{/* end game column */}

      {/* Right: case files panel — always visible on desktop, full-screen overlay on mobile */}
      <div className={`chat-sidebar md:relative md:flex md:w-64 md:shrink-0 fixed inset-0 z-50 transition-transform duration-200 ${showSidebar ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
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
