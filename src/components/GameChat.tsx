'use client';

import { useState, useEffect, useRef } from 'react';
import type { GameSession, Message, Player } from '@/types';
import StatsBar from './StatsBar';
import VoiceButton from './VoiceButton';

interface GameChatProps {
  session: GameSession;
  initialMessages: Message[];
}

// msgId → { prompt, type }
interface DynamicImageMeta { prompt: string; type: string }

// Inline image component for dynamic images
function DynamicImage({ prompt, type }: { prompt: string; type: string }) {
  const [src, setSrc]         = useState<string | null>(null);
  const [error, setError]     = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    const url = `/api/image?prompt=${encodeURIComponent(prompt)}&type=${encodeURIComponent(type)}`;
    fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((blob) => setSrc(URL.createObjectURL(blob)))
      .catch(() => setError(true));
  }, [prompt, type]);

  if (error) return null;

  if (!src) {
    return (
      <div className="mt-2 rounded-xl overflow-hidden bg-stone-700 animate-pulse" style={{ height: 160 }} />
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

// Case files drawer (static scenario images)
function CaseFilesDrawer({
  scenarioId,
  onClose,
}: {
  scenarioId: string;
  onClose: () => void;
}) {
  const [images, setImages] = useState<{ id: string; url: string; label: string }[]>([]);
  const [fullscreen, setFullscreen] = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    fetch(`/api/scenarios/${scenarioId}/images`)
      .then((r) => r.json())
      .then((d) => { setImages(d.images ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [scenarioId]);

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/60" onClick={onClose} />
      {/* Panel */}
      <div className="w-72 bg-stone-900 border-l border-stone-700 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700">
          <h2 className="text-sm font-semibold text-amber-500">Матеріали справи</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {loading && (
            <p className="text-xs text-stone-600 text-center py-4">Завантаження...</p>
          )}
          {!loading && images.length === 0 && (
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

export default function GameChat({ session: initialSession, initialMessages }: GameChatProps) {
  const [session, setSession]   = useState<GameSession>(initialSession);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [voiceStyles, setVoiceStyles]         = useState<Record<string, string>>({});
  const [dynamicImages, setDynamicImages]     = useState<Record<string, DynamicImageMeta>>({});
  const [input, setInput]       = useState('');
  const [isLoading, setIsLoading]             = useState(false);
  const [speakingId, setSpeakingId]           = useState<string | null>(null);
  const [loadingAudioIds, setLoadingAudioIds] = useState<Set<string>>(new Set());
  const [activePlayer, setActivePlayer]       = useState(0);
  const [showCaseFiles, setShowCaseFiles]     = useState(false);
  const [ttsProvider, setTtsProvider]         = useState<'openai' | 'elevenlabs'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('ttsProvider') as 'openai' | 'elevenlabs') ?? 'openai';
    }
    return 'openai';
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const audioRef       = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef  = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Trigger static image generation in background when session starts
  useEffect(() => {
    fetch(`/api/scenarios/${session.scenario_id}/images`, { method: 'POST' }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-generate intro if no messages yet
  const introRequested = useRef(false);
  useEffect(() => {
    if (initialMessages.length === 0 && !introRequested.current) {
      introRequested.current = true;
      setIsLoading(true);
      fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, message: '__intro__', playerIdx: 0 }),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          const introId = Date.now().toString();
          setMessages([{
            id: introId,
            session_id: session.id,
            role: 'assistant',
            content: data.response,
            player_idx: null,
            created_at: new Date().toISOString(),
          }]);
          if (data.voiceStyle)   setVoiceStyles({ [introId]: data.voiceStyle });
          if (data.world_state)  setSession((s) => ({ ...s, world_state: data.world_state }));
          if (data.imagePrompt)  setDynamicImages({ [introId]: { prompt: data.imagePrompt, type: data.imageType ?? 'scene' } });
          speakMsg(introId, data.response, data.voiceStyle);
        })
        .catch(() => {/* silent */})
        .finally(() => setIsLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── TTS ─────────────────────────────────────────────────────────────────────

  function stopAudio() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
  }

  function toggleProvider() {
    setTtsProvider((prev) => {
      const next = prev === 'openai' ? 'elevenlabs' : 'openai';
      localStorage.setItem('ttsProvider', next);
      audioCacheRef.current.clear(); // clear cache so new provider is used
      return next;
    });
  }

  async function speakMsg(msgId: string, text: string, voiceStyle?: string) {
    stopAudio();
    const cached = audioCacheRef.current.get(msgId);
    if (cached) { playUrl(msgId, cached); return; }

    setLoadingAudioIds((prev) => new Set(prev).add(msgId));
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceStyle: voiceStyle ?? 'keeper', provider: ttsProvider }),
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
    speakMsg(msgId, text, voiceStyles[msgId]);
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

  // ── Send message ─────────────────────────────────────────────────────────────

  async function sendMessage(text?: string) {
    const messageText = (text || input).trim();
    if (!messageText || isLoading) return;

    setInput('');
    setIsLoading(true);

    const userMsg: Message = {
      id: Date.now().toString(),
      session_id: session.id,
      role: 'user',
      content: messageText,
      player_idx: activePlayer,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, message: messageText, playerIdx: activePlayer }),
      });
      if (!res.ok) throw new Error('AI request failed');

      const data = await res.json();
      const msgId = (Date.now() + 1).toString();

      setMessages((prev) => [...prev, {
        id: msgId,
        session_id: session.id,
        role: 'assistant',
        content: data.response,
        player_idx: null,
        created_at: new Date().toISOString(),
      }]);

      if (data.voiceStyle)  setVoiceStyles((prev) => ({ ...prev, [msgId]: data.voiceStyle }));
      if (data.world_state) setSession((s) => ({ ...s, world_state: data.world_state }));
      if (data.players)     setSession((s) => ({ ...s, players: data.players }));
      if (data.imagePrompt) setDynamicImages((prev) => ({
        ...prev, [msgId]: { prompt: data.imagePrompt, type: data.imageType ?? 'scene' },
      }));

      speakMsg(msgId, data.response, data.voiceStyle);
    } catch {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 2).toString(),
        session_id: session.id,
        role: 'assistant',
        content: 'Помилка зв\'язку. Спробуй ще раз.',
        player_idx: null,
        created_at: new Date().toISOString(),
      }]);
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
    <div className="flex flex-col h-screen bg-stone-950 text-stone-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-stone-900 border-b border-stone-700">
        <div>
          <h1 className="text-sm font-semibold text-stone-200">{session.name}</h1>
          <p className="text-xs text-stone-500">Акт {session.world_state?.act || 1}</p>
        </div>
        <div className="flex gap-2">
          {speakingId && (
            <button onClick={stopAudio} className="text-xs px-2 py-1 bg-stone-700 hover:bg-stone-600 rounded text-stone-300">
              ⏹ Стоп
            </button>
          )}
          <button
            onClick={toggleProvider}
            title={ttsProvider === 'elevenlabs' ? 'ElevenLabs (перемкнути на OpenAI)' : 'OpenAI TTS (перемкнути на ElevenLabs)'}
            className="text-xs px-2 py-1 bg-stone-800 hover:bg-stone-700 rounded text-stone-400"
          >
            {ttsProvider === 'elevenlabs' ? '🔊 11Labs' : '🔊 GPT'}
          </button>
          <button
            onClick={() => setShowCaseFiles(true)}
            className="text-xs px-2 py-1 bg-stone-800 hover:bg-stone-700 rounded text-amber-600"
            title="Матеріали справи"
          >
            📁 Справа
          </button>
          <a href="/" className="text-xs px-2 py-1 bg-stone-800 hover:bg-stone-700 rounded text-stone-400">
            ← Назад
          </a>
        </div>
      </div>

      <StatsBar players={session.players} onUpdatePlayers={updatePlayers} />

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
          const imgMeta    = !isUser ? dynamicImages[msg.id] : undefined;

          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
                {isUser && player && (
                  <p className="text-xs text-stone-500 mb-1 text-right">{player.name}</p>
                )}
                {!isUser && <p className="text-xs text-amber-700 mb-1">Кіпер</p>}
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-stone-700 text-stone-100 rounded-tr-sm'
                    : 'bg-stone-800 text-stone-200 rounded-tl-sm border border-stone-700'
                }`}>
                  {msg.content}
                  {imgMeta && <DynamicImage prompt={imgMeta.prompt} type={imgMeta.type} />}
                </div>
                {!isUser && (
                  <button
                    onClick={() => handleReplay(msg.id, msg.content)}
                    disabled={isLoadingA}
                    className={`text-xs mt-1 ml-1 transition-colors ${
                      isPlaying   ? 'text-amber-500 animate-pulse' :
                      isLoadingA  ? 'text-stone-600 cursor-wait'   :
                                    'text-stone-600 hover:text-stone-400'
                    }`}
                  >
                    {isPlaying ? '⏸ зупинити' : isLoadingA ? '⏳' : '↻ озвучити'}
                  </button>
                )}
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
        <div className="flex gap-1 px-3 py-2 bg-stone-900 border-t border-stone-800">
          {session.players.map((p, i) => (
            <button
              key={i}
              onClick={() => setActivePlayer(i)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                activePlayer === i ? 'bg-amber-800 text-amber-100' : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 pt-2 bg-stone-900 border-t border-stone-800">
        <div className="flex gap-2 items-end">
          <div className="flex-1 bg-stone-800 rounded-xl border border-stone-700 overflow-hidden">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`${playerName}: дія або слова...`}
              rows={2}
              className="w-full bg-transparent text-stone-200 placeholder-stone-600 text-sm px-3 py-2 resize-none focus:outline-none"
              disabled={isLoading}
            />
          </div>
          <div className="flex flex-col gap-1">
            <VoiceButton onTranscript={(t) => sendMessage(t)} disabled={isLoading} />
            <button
              onClick={() => sendMessage()}
              disabled={isLoading || !input.trim()}
              className="p-2 bg-amber-800 hover:bg-amber-700 disabled:bg-stone-700 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
            >
              ➤
            </button>
          </div>
        </div>
      </div>

      {/* Case files drawer */}
      {showCaseFiles && (
        <CaseFilesDrawer scenarioId={session.scenario_id} onClose={() => setShowCaseFiles(false)} />
      )}
    </div>
  );
}
