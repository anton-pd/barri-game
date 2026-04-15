'use client';

import { useState, useEffect, useRef } from 'react';
import type { GameSession, Message, Player, ScenarioBriefing, NPC } from '@/types';
import type { Segment } from '@/lib/segments';
import { hasNpcSpeech, parseSegments, stripNpcTags } from '@/lib/segments';
import type { AiProvider } from '@/app/api/ai/route';
import StatsBar from './StatsBar';
import VoiceButton from './VoiceButton';
import DiceRoller from './DiceRoller';

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
  scenarioNpcs?: NPC[];
  defaultAiProvider?: AiProvider;
  defaultTtsProvider?: 'openai' | 'gemini';
}

// msgId → { prompt, type }
interface DynamicImageMeta { prompt: string; type: string }

// Inline image component for dynamic images
// CHANGED: Supports static url resolving from session
function DynamicImage({ prompt, type, sessionId, msgId, url, onUrlGenerated }: { prompt: string; type: string; sessionId: string; msgId?: string; url?: string; onUrlGenerated?: (msgId: string, url: string) => void }) {
  const [src, setSrc]         = useState<string | null>(url || null);
  const [error, setError]     = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (url) {
      setSrc(url);
      return;
    }
    if (fetched.current || !msgId || !onUrlGenerated) return;
    fetched.current = true;
    
    const urlStr = `/api/image?prompt=${encodeURIComponent(prompt)}&type=${encodeURIComponent(type)}&sessionId=${encodeURIComponent(sessionId)}&json=true`;
    fetch(urlStr)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (data.url) {
          setSrc(data.url);
          onUrlGenerated(msgId, data.url);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true));
  }, [prompt, type, sessionId, url, msgId, onUrlGenerated]);

  if (error) return null;

  if (!src) {
    return (
      <div className="mt-2 rounded-xl overflow-hidden bg-stone-800 animate-pulse flex items-center justify-center border border-stone-700" style={{ height: 160 }}>
        <span className="text-stone-500 text-xs font-medium uppercase tracking-wide">Генерується зображення...</span>
      </div>
    );
  }

  return (
    <>
      <img
        src={src}
        alt=""
        onClick={() => setFullscreen(true)}
        className="mt-2 rounded-xl w-full object-cover cursor-zoom-in border border-stone-600"
        style={{ maxHeight: 220 }}
      />
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFullscreen(false)}
        >
          <img src={src} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>
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
  players,
  briefing,
  npcs,
  npcRelations,
  dynamicNpcs,
  dynamicImages,
  sessionImages,
  onUrlGenerated,
  sessionId,
  onClose,
}: {
  scenarioId: string;
  players: Player[];
  briefing?: ScenarioBriefing | null;
  npcs: NPC[];
  npcRelations: Record<string, 'friendly' | 'neutral' | 'hostile' | 'unknown'>;
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
  const [fullscreen, setFullscreen] = useState<string | null>(null);
  const [loadingImgs, setLoadingImgs] = useState(false);

  useEffect(() => {
    if (tab !== 'images') return;
    setLoadingImgs(true);
    fetch(`/api/scenarios/${scenarioId}/images`)
      .then((r) => r.json())
      .then((d) => { setImages(d.images ?? []); })
      .catch(() => {})
      .finally(() => setLoadingImgs(false));
  }, [tab, scenarioId]);

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

  return (
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
                <div className="flex gap-3 text-xs pt-1">
                  <span className="text-red-400">HP {p.hp}/{p.maxHp}</span>
                  <span className="text-purple-400">SAN {p.sanity}/{p.maxSanity}</span>
                  <span className="text-amber-400">LCK {p.luck}/{p.maxLuck}</span>
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
            {Object.keys(dynamicImages).length > 0 && (images.length > 0 || loadingImgs) && (
              <div className="border-t border-stone-800 pt-3">
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Сценарні матеріали</p>
              </div>
            )}
            {loadingImgs && (
              <p className="text-xs text-stone-600 text-center py-4">Завантаження...</p>
            )}
            {!loadingImgs && images.length === 0 && Object.keys(dynamicImages).length === 0 && (
              <p className="text-xs text-stone-600 text-center py-4">Матеріали ще генеруються...</p>
            )}
            {images.map((img) => (
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
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFullscreen(null)}
        >
          <img src={fullscreen} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
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

export default function GameChat({ session: initialSession, initialMessages, briefing, locationNames = {}, scenarioNpcs = [], defaultAiProvider = 'gemini-flash', defaultTtsProvider = 'gemini' }: GameChatProps) {
  const [session, setSession]   = useState<GameSession>(initialSession);

  const handleUrlGenerated = (msgId: string, url: string) => {
    setSession((s) => {
      const updatedImages = { ...(s.world_state.sessionImages ?? {}), [msgId]: url };
      const updatedWorldState = { ...s.world_state, sessionImages: updatedImages };
      
      fetch(`/api/sessions/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ world_state: updatedWorldState }),
      }).catch(console.error);
      
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
  const [pendingActions, setPendingActions]   = useState<{ playerIdx: number; text: string }[]>([]);
  const pendingItemUsesRef = useRef<{ playerIdx: number; itemId: string }[]>([]);
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

  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const textareaRef       = useRef<HTMLTextAreaElement>(null);
  const audioRef          = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef     = useRef<Map<string, string>>(new Map());
  const ambientRef        = useRef<HTMLAudioElement | null>(null);
  const [ttsProvider] = useState<'openai' | 'gemini'>(defaultTtsProvider);
  const [aiProvider]  = useState<AiProvider>(defaultAiProvider);
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

  // Auto-generate intro if no messages yet
  const introRequested = useRef(false);
  useEffect(() => {
    if (initialMessages.length !== 0 || introRequested.current) return;
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
        if (data.location)    { setCurrentLocation(data.location as string); setCurrentLocationName((data.locationName as string | null) ?? null); playAmbient(data.location as string); }
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

  function playAmbient(locationId: string) {
    const url = `/scenarios/${session.scenario_id}/sounds/${locationId}.mp3`;
    const prev = ambientRef.current;

    // Fade out previous
    if (prev) {
      const fadeOut = setInterval(() => {
        if (prev.volume > 0.05) { prev.volume = Math.max(0, prev.volume - 0.05); }
        else { clearInterval(fadeOut); prev.pause(); prev.src = ''; }
      }, 80);
    }

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

  function handleUseItem(playerIdx: number, itemId: string, itemName: string) {
    // Track for post-send decrement
    pendingItemUsesRef.current = [...pendingItemUsesRef.current, { playerIdx, itemId }];
    // Switch to that player and insert text into input
    setActivePlayer(playerIdx);
    setInput((prev) => prev ? `${prev} (використовує: ${itemName})` : `(використовує: ${itemName}) `);
    textareaRef.current?.focus();
  }

  function consumePendingItems(players: Player[]): Player[] {
    const uses = pendingItemUsesRef.current;
    if (uses.length === 0) return players;
    pendingItemUsesRef.current = [];
    return players.map((p, pIdx) => {
      const itemsToConsume = uses.filter((u) => u.playerIdx === pIdx);
      if (itemsToConsume.length === 0) return p;
      const updatedInventory = (p.inventory ?? []).reduce<typeof p.inventory>((acc, item) => {
        const consumed = itemsToConsume.some((u) => u.itemId === item.id);
        if (!consumed) return [...acc, item];
        if (item.uses === -1) return [...acc, item]; // infinite — don't decrement
        if (item.uses <= 1) return acc;              // 1 use left — remove
        return [...acc, { ...item, uses: item.uses - 1 }];
      }, []);
      return { ...p, inventory: updatedInventory };
    });
  }

  // ── Players ──────────────────────────────────────────────────────────────────

  async function updatePlayers(players: Player[]) {
    setSession((s) => ({ ...s, players }));
    await fetch(`/api/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ players }),
    });
  }

  // ── Queue action ─────────────────────────────────────────────────────────────

  function queueAction() {
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
        playAmbient(data.location as string);
      }

      // Apply AI-granted items, then consume used items
      const playersAfterAI = (data.players as typeof session.players) ?? session.players;
      const playersAfterConsume = consumePendingItems(playersAfterAI);
      if (playersAfterConsume !== session.players) {
        setSession((s) => ({ ...s, players: playersAfterConsume }));
        await fetch(`/api/sessions/${session.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ players: playersAfterConsume }),
        });
      } else if (data.players) {
        setSession((s) => ({ ...s, players: data.players as typeof s.players }));
      }

      if (data.imagePrompt) setDynamicImages((prev) => ({
        ...prev, [realId]: { prompt: data.imagePrompt as string, type: (data.imageType as string) ?? 'scene' },
      }));

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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const playerName = session.players[activePlayer]?.name || 'Гравець';

  return (
    <div className="flex h-dvh bg-stone-950 text-stone-200 overflow-hidden">
      {/* Left: game column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-stone-900 border-b border-stone-800">
        <div className="flex items-center gap-2 min-w-0">
          <a
            href="/"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-stone-400 transition-colors shrink-0"
            title="Назад"
          >←</a>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-stone-200 truncate leading-tight">{session.name}</h1>
            <p className="text-[11px] text-stone-500 truncate leading-tight">{currentLocationName ?? (currentLocation ? currentLocation.replace(/_/g, ' ') : `Акт ${session.world_state?.act || 1}`)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {speakingId && (
            <button
              onClick={stopAudio}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-stone-700 hover:bg-stone-600 active:bg-stone-500 text-stone-300 transition-colors text-sm"
              title="Зупинити"
            >⏹</button>
          )}
          <button
            onClick={() => setShowSidebar((v) => !v)}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-stone-400 transition-colors text-sm"
            title="Матеріали справи"
          >📋</button>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-sm ${showSettings ? 'bg-stone-700 text-stone-200' : 'bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-stone-400'}`}
            title="Налаштування звуку"
          >⚙️</button>
        </div>
      </div>

      {/* Collapsible settings panel */}
      {showSettings && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-stone-900/95 border-b border-stone-800 text-xs">
          {/* CHANGED: KeeperStyle selector */}
          <div className="flex items-center bg-stone-800 rounded-lg overflow-hidden border border-stone-700">
            {(['passive', 'balanced', 'active'] as const).map((s) => (
              <button
                key={s}
                onClick={() => changeKeeperStyle(s)}
                title={
                  s === 'passive'  ? 'Кіпер чекає дій гравців' :
                  s === 'balanced' ? 'Кіпер підказує при пасивності (3+ ходи)' :
                  'Кіпер активно підштовхує сюжет'
                }
                className={`px-2.5 py-1.5 transition-colors text-xs ${
                  keeperStyle === s
                    ? 'bg-amber-800 text-amber-100 font-medium'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-700'
                }`}
              >
                {s === 'passive' ? 'Пасив' : s === 'balanced' ? 'Баланс' : 'Актив'}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-stone-700" />

          <Toggle checked={autoVoiceEnabled} onChange={() => setAutoVoiceEnabled((v) => !v)} label="Автоозвучення" />
          <Toggle checked={ambientEnabled} onChange={() => setAmbientEnabled((v) => !v)} label="Ambient" />
          <Toggle checked={diceMode === 'virtual'} onChange={toggleDiceMode} label="Віртуальні кубики" />
          {ambientEnabled && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-stone-800 rounded-lg">
              <span className="text-stone-500">🔈</span>
              <input
                type="range" min={0} max={1} step={0.05}
                value={ambientVolume}
                onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                className="w-20 accent-amber-600"
                title="Гучність ambient"
              />
              <span className="text-stone-500">🔊</span>
            </div>
          )}
        </div>
      )}

      <StatsBar players={session.players} onUpdatePlayers={updatePlayers} onUseItem={handleUseItem} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-stone-600 text-sm mt-8">
            <p className="text-2xl mb-2">📜</p>
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
            <button
              onClick={() => handleReplay(msg.id, displayContent)}
              disabled={isLoadingA}
              className={`text-xs mt-1 ml-1 transition-colors ${
                isPlaying   ? 'text-amber-500 animate-pulse' :
                isLoadingA  ? 'text-stone-600 cursor-wait'   :
                              'text-stone-600 hover:text-stone-400'
              }`}
            >
              {isPlaying ? '⏸ зупинити' : isLoadingA ? '⏳' : '↻ озвучити'}
            </button>
          );

          // ── User message ────────────────────────────────────────────────────
          if (isUser) {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%]">
                  {player && <p className="text-xs text-stone-500 mb-1 text-right">{player.name}</p>}
                  <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed bg-stone-700 text-stone-100 rounded-tr-sm">
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
                          {si === 0 && <p className="text-xs text-amber-700 mb-1">Кіпер</p>}
                          <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed bg-stone-800 text-stone-200 rounded-tl-sm border border-stone-700">
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
                          <p className="text-xs text-amber-500 mb-1">{seg.name}</p>
                          <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed italic bg-stone-800/60 text-stone-200 rounded-tl-sm border border-amber-900/40">
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
                <p className="text-xs text-amber-700 mb-1">Кіпер</p>
                <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed bg-stone-800 text-stone-200 rounded-tl-sm border border-stone-700">
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
            <div className="bg-stone-800 border border-stone-700 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-amber-700 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-amber-700 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-amber-700 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Player selector */}
      {session.players.length > 1 && (
        <div className="flex gap-1.5 px-3 py-2 bg-stone-900 border-t border-stone-800">
          {session.players.map((p, i) => (
            <button
              key={i}
              onClick={() => setActivePlayer(i)}
              className={`text-xs px-3 py-2 rounded-xl transition-colors min-h-[36px] ${
                activePlayer === i
                  ? 'bg-amber-800 text-amber-100 font-medium'
                  : 'bg-stone-800 text-stone-400 hover:bg-stone-700 active:bg-stone-600'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Pending actions queue */}
      {pendingActions.length > 0 && (
        <div className="px-3 pt-2 pb-1 bg-stone-900 border-t border-stone-800 flex flex-wrap gap-1">
          {pendingActions.map((a, i) => (
            <span
              key={i}
              className="flex items-center gap-1 text-xs bg-stone-700 text-stone-200 rounded-full px-2 py-1"
            >
              <span className="text-amber-500 font-medium">{session.players[a.playerIdx]?.name}</span>
              <span className="text-stone-400 max-w-[140px] truncate">{a.text}</span>
              <button
                onClick={() => removePending(i)}
                className="text-stone-500 hover:text-stone-300 ml-0.5"
              >✕</button>
            </span>
          ))}
        </div>
      )}

      {/* Inventory strip — active player's usable items */}
      {(session.players[activePlayer]?.inventory ?? []).filter(item => !item.broken && item.uses !== 0).length > 0 && (
        <div className="px-3 py-1.5 bg-stone-900 border-t border-stone-800 flex gap-1.5 overflow-x-auto scrollbar-none">
          {session.players[activePlayer].inventory
            .filter(item => !item.broken && item.uses !== 0)
            .map(item => (
              <button
                key={item.id}
                onClick={() => handleUseItem(activePlayer, item.id, item.name)}
                title={item.description}
                className="flex-shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded-lg border bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700 active:bg-stone-600 transition-colors whitespace-nowrap"
              >
                {item.equipped ? '⚔' : '📦'} {item.name}
                {item.uses > 0 && <span className="text-stone-500">×{item.uses}</span>}
                {item.uses === -1 && <span className="text-stone-500">∞</span>}
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
        <div className="px-3 py-2 bg-stone-900 border-t border-stone-800 flex items-center gap-2">
          <span className="text-lg">🎲</span>
          <span className="text-xs text-stone-400">
            <span className="text-amber-400 font-medium">{session.world_state.pendingRollResult.skillName}</span>
            {' — кинь ≤ '}
            <span className="text-amber-300 font-mono">{session.world_state.pendingRollResult.goodThreshold}</span>
            {' і введи результат'}
          </span>
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-safe-or-3 pb-3 pt-2 bg-stone-900 border-t border-stone-800">
        <div className="flex gap-2 items-end">
          <div className="flex-1 bg-stone-800 rounded-2xl border border-stone-700 focus-within:border-stone-600 overflow-hidden transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`${playerName}: дія або слова...`}
              rows={2}
              className="w-full bg-transparent text-stone-200 placeholder-stone-600 text-sm px-3.5 py-2.5 resize-none focus:outline-none leading-relaxed"
              style={{ fontSize: 16 }}
              disabled={isLoading}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <VoiceButton onTranscript={(t) => sendMessage(t)} disabled={isLoading} />
            {session.players.length > 1 && (
              <button
                onClick={queueAction}
                disabled={isLoading || !input.trim()}
                title="Додати в чергу (наступний гравець)"
                className="w-9 h-9 bg-stone-700 hover:bg-stone-600 active:bg-stone-500 disabled:bg-stone-800 disabled:cursor-not-allowed rounded-xl text-stone-300 transition-colors text-base font-bold flex items-center justify-center"
              >+</button>
            )}
            <button
              onClick={() => sendMessage()}
              disabled={isLoading || (!input.trim() && pendingActions.length === 0)}
              className="w-9 h-9 bg-amber-800 hover:bg-amber-700 active:bg-amber-900 disabled:bg-stone-700 disabled:cursor-not-allowed rounded-xl text-white transition-colors flex items-center justify-center"
            >➤</button>
          </div>
        </div>
      </div>

      </div>{/* end game column */}

      {/* Right: case files panel — always visible on desktop, full-screen overlay on mobile */}
      <div className={`
        md:relative md:flex md:w-64 md:shrink-0
        fixed inset-0 z-50
        transition-transform duration-200
        ${showSidebar ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}>
        <CaseFilesPanel
          scenarioId={session.scenario_id}
          players={session.players}
          briefing={briefing}
          npcs={scenarioNpcs}
          npcRelations={session.world_state?.npcRelations ?? {}}
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
