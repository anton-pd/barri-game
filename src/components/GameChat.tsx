'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameSession, Message, Player } from '@/types';
import StatsBar from './StatsBar';
import VoiceButton from './VoiceButton';

interface GameChatProps {
  session: GameSession;
  initialMessages: Message[];
}

export default function GameChat({ session: initialSession, initialMessages }: GameChatProps) {
  const [session, setSession] = useState<GameSession>(initialSession);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activePlayer, setActivePlayer] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function speak(text: string) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'uk-UA';
    utterance.rate = 0.85;
    utterance.pitch = 0.9;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }

  async function updatePlayers(players: Player[]) {
    setSession((s) => ({ ...s, players }));
    await fetch(`/api/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ players }),
    });
  }

  async function sendMessage(text?: string) {
    const messageText = (text || input).trim();
    if (!messageText || isLoading) return;

    setInput('');
    setIsLoading(true);

    const userMessage: Message = {
      id: Date.now().toString(),
      session_id: session.id,
      role: 'user',
      content: messageText,
      player_idx: activePlayer,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          message: messageText,
          playerIdx: activePlayer,
        }),
      });

      if (!res.ok) throw new Error('AI request failed');

      const data = await res.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        session_id: session.id,
        role: 'assistant',
        content: data.response,
        player_idx: null,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.world_state) {
        setSession((s) => ({ ...s, world_state: data.world_state }));
      }

      speak(data.response);
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          session_id: session.id,
          role: 'assistant',
          content: 'Помилка зв\'язку. Спробуй ще раз.',
          player_idx: null,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
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
          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              className="text-xs px-2 py-1 bg-stone-700 hover:bg-stone-600 rounded text-stone-300"
            >
              ⏹ Стоп
            </button>
          )}
          <a
            href="/"
            className="text-xs px-2 py-1 bg-stone-800 hover:bg-stone-700 rounded text-stone-400"
          >
            ← Назад
          </a>
        </div>
      </div>

      {/* Stats */}
      <StatsBar players={session.players} onUpdatePlayers={updatePlayers} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-stone-600 text-sm mt-8">
            <p className="text-2xl mb-2">📜</p>
            <p>Гра починається. Напишіть перше повідомлення.</p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const player = isUser && msg.player_idx !== null ? session.players[msg.player_idx] : null;

          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
                {isUser && player && (
                  <p className="text-xs text-stone-500 mb-1 text-right">{player.name}</p>
                )}
                {!isUser && (
                  <p className="text-xs text-amber-700 mb-1">Кіпер</p>
                )}
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-stone-700 text-stone-100 rounded-tr-sm'
                      : 'bg-stone-800 text-stone-200 rounded-tl-sm border border-stone-700'
                  }`}
                >
                  {msg.content}
                </div>
                {!isUser && (
                  <button
                    onClick={() => speak(msg.content)}
                    className="text-xs text-stone-600 hover:text-stone-400 mt-1 ml-1"
                  >
                    ↻ озвучити
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
                activePlayer === i
                  ? 'bg-amber-800 text-amber-100'
                  : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
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
    </div>
  );
}
