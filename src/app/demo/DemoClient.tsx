'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type DemoRole = 'keeper' | 'player' | 'system';

interface DemoMessage {
  id: string;
  role: DemoRole;
  text: string;
  meta?: string;
}

interface DemoInventoryItem {
  id: string;
  name: string;
  description: string;
  uses: number;
  equipped?: boolean;
  broken?: boolean;
}

interface DemoPlayer {
  name?: string;
  inventory: DemoInventoryItem[];
  skills?: Record<string, number>;
}

interface DemoWorldState {
  act: number;
  currentLocation?: string;
  visitedLocations: string[];
  discoveredClues: string[];
  npcRelations: Record<string, 'friendly' | 'neutral' | 'hostile' | 'unknown'>;
  summary: string;
  openThreads: string[];
  playerNotes: string[];
  totalMessageCount?: number;
  pendingRollResult?: {
    characterIdx: number;
    skillName: string;
    skillValue: number;
    context: string;
    goodThreshold: number;
  };
}

interface DemoFlags {
  doorInspected: boolean;
  hasPin: boolean;
  hasPassphrase: boolean;
  archiveOpen: boolean;
}

interface KeeperReply {
  text: string;
  meta?: string;
  completed?: boolean;
  completionReason?: 'objective' | 'message_limit' | null;
  worldState: DemoWorldState;
  players: DemoPlayer[];
}

const MAX_USER_MESSAGES = 10;
const DEMO_SECONDS = 5 * 60;

const initialWorldState: DemoWorldState = {
  act: 1,
  currentLocation: 'archive_threshold',
  visitedLocations: ['archive_threshold', 'intake_desk'],
  discoveredClues: [],
  npcRelations: { archive_echo: 'unknown' },
  summary:
    'The investigator stands before Archive 7 after midnight. The door is sealed, but the corridor offers clues for a careful mind.',
  openThreads: ['Find a way into the secret archive'],
  playerNotes: [],
  totalMessageCount: 0,
};

const initialMessages: DemoMessage[] = [
  {
    id: 'intro',
    role: 'keeper',
    meta: 'Keeper',
    text: 'Rain needles the high windows of the Bureau. You stand before a sealed archive door marked CASES THAT REFUSED TO DIE. Brass hinges. No handle. A thin keyhole listens back.',
  },
  {
    id: 'briefing',
    role: 'system',
    meta: 'Objective',
    text: 'Find a way into the secret archive. Speak naturally, or use the suggested actions below.',
  },
];

function hasInventoryItem(players: DemoPlayer[] | null, name: string) {
  return players?.some((player) =>
    player.inventory?.some((item) => item.name.toLowerCase().includes(name))
  ) ?? false;
}

function getFlags(worldState: DemoWorldState, players: DemoPlayer[] | null): DemoFlags {
  const clues = new Set(worldState.discoveredClues);
  return {
    doorInspected: clues.has('door_inspected'),
    hasPin: clues.has('silver_pin') || hasInventoryItem(players, 'silver filing pin'),
    hasPassphrase: clues.has('passphrase'),
    archiveOpen: clues.has('archive_open') || worldState.currentLocation === 'inner_archive',
  };
}

function getSuggestions(flags: DemoFlags, worldState: DemoWorldState) {
  if (flags.archiveOpen) return ['Join the waitlist'];
  if (worldState.pendingRollResult) return ['Roll 32', 'Roll 78'];
  if (flags.hasPin) return ['Use the silver pin on the lock', 'Listen at the keyhole', 'Open the archive door'];
  if (flags.hasPassphrase) return ['Say the passphrase into the keyhole', 'Search the intake desk', 'Inspect the brass door'];
  if (flags.doorInspected) return ['Search the intake desk', 'Listen at the keyhole', 'Try to open the door'];
  return ['Inspect the brass door', 'Search the intake desk', 'Listen at the keyhole'];
}

function countClues(flags: DemoFlags) {
  return [flags.doorInspected, flags.hasPin, flags.hasPassphrase].filter(Boolean).length;
}

export default function DemoClient() {
  const [messages, setMessages] = useState<DemoMessage[]>(initialMessages);
  const [worldState, setWorldState] = useState<DemoWorldState>(initialWorldState);
  const [players, setPlayers] = useState<DemoPlayer[] | null>(null);
  const [input, setInput] = useState('');
  const [userMessages, setUserMessages] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [ending, setEnding] = useState<'completed' | 'message_limit' | 'manual' | null>(null);
  const [email, setEmail] = useState('');
  const [waitlistState, setWaitlistState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [waitlistError, setWaitlistError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(DEMO_SECONDS);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const flags = useMemo(() => getFlags(worldState, players), [worldState, players]);
  const suggestions = useMemo(() => getSuggestions(flags, worldState), [flags, worldState]);
  const clueCount = countClues(flags);

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, thinking]);

  useEffect(() => {
    if (ending) return undefined;
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => {
        if (value <= 1) {
          setEnding('message_limit');
          return 0;
        }
        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [ending]);

  function addMessage(message: Omit<DemoMessage, 'id'>) {
    setMessages((prev) => [
      ...prev,
      {
        ...message,
        id: `${Date.now()}-${prev.length}`,
      },
    ]);
  }

  async function submitTurn(value: string) {
    const trimmed = value.trim();
    if (!trimmed || thinking || ending) return;

    const nextCount = userMessages + 1;
    const history = messages
      .filter((message): message is DemoMessage & { role: 'keeper' | 'player' } =>
        message.role === 'keeper' || message.role === 'player'
      )
      .map((message) => ({ role: message.role, text: message.text }));

    setUserMessages(nextCount);
    setInput('');
    addMessage({ role: 'player', meta: 'You', text: trimmed });
    setThinking(true);

    try {
      const res = await fetch('/api/demo/keeper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history,
          worldState,
          players,
        }),
      });
      const reply = await res.json() as KeeperReply | { error?: string };
      if (!res.ok || !('text' in reply)) {
        throw new Error('error' in reply && reply.error ? reply.error : 'Keeper did not answer.');
      }

      setWorldState(reply.worldState);
      setPlayers(reply.players);
      addMessage({ role: 'keeper', meta: reply.meta ?? 'Keeper', text: reply.text });

      if (reply.completed) {
        setEnding('completed');
      } else if (nextCount >= MAX_USER_MESSAGES) {
        addMessage({
          role: 'system',
          meta: 'Archive notice',
          text: 'The Keeper closes the preview file at ten entries. The full dossier waits beyond registration.',
        });
        setEnding('message_limit');
      }
    } catch (error) {
      addMessage({
        role: 'system',
        meta: 'Connection',
        text: error instanceof Error
          ? `The Keeper cannot reach the file right now: ${error.message}`
          : 'The Keeper cannot reach the file right now.',
      });
    } finally {
      setThinking(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitTurn(input);
  }

  async function submitWaitlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWaitlistState('loading');
    setWaitlistError('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'instant-demo',
          locale: 'en',
          outcome: ending ?? 'manual',
          messageCount: userMessages,
          notes: `Archive demo clues=${clueCount}; archiveOpen=${flags.archiveOpen}`,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Could not file the request.');
      }

      setWaitlistState('success');
    } catch (error) {
      setWaitlistState('error');
      setWaitlistError(error instanceof Error ? error.message : 'Could not file the request.');
    }
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  return (
    <>
      <main className="demo-shell">
        <header className="demo-topbar">
          <Link href="/" className="demo-brand" aria-label="Back to Barri landing">
            <span className="demo-seal">B</span>
            <span>Barri</span>
          </Link>
          <div className="demo-top-actions">
            <span className="demo-file">Demo file / Archive 7</span>
            <Link href="/auth/login" className="demo-login">Sign in</Link>
          </div>
        </header>

        <section className="demo-stage" aria-label="Playable instant demo">
          <aside className="demo-dossier" aria-label="Case status">
            <div className="demo-dossier-label">5-minute preview</div>
            <h1>The Archive Door</h1>
            <p>
              You are outside a secret Bureau archive. The Keeper will respond to your choices, track
              what you discover, and close the file when you get inside.
            </p>

            <div className="demo-progress" aria-label="Demo progress">
              <div>
                <span>Entries</span>
                <strong>{userMessages}/{MAX_USER_MESSAGES}</strong>
              </div>
              <div>
                <span>Clock</span>
                <strong>{minutes}:{seconds}</strong>
              </div>
              <div>
                <span>Clues</span>
                <strong>{clueCount}/3</strong>
              </div>
            </div>

            <div className="demo-evidence">
              <div className={flags.doorInspected ? 'found' : ''}>Brass door inspected</div>
              <div className={flags.hasPin ? 'found' : ''}>Silver filing pin found</div>
              <div className={flags.hasPassphrase ? 'found' : ''}>Passphrase overheard</div>
              <div className={flags.archiveOpen ? 'found' : ''}>Archive opened</div>
            </div>

            <div className="demo-roll">
              <span>Last check</span>
              {worldState.pendingRollResult ? (
                <strong>{worldState.pendingRollResult.skillName} {'<='} {worldState.pendingRollResult.goodThreshold}</strong>
              ) : flags.archiveOpen ? (
                <strong>Resolved</strong>
              ) : (
                <strong>Keeper driven</strong>
              )}
            </div>
          </aside>

          <section className="demo-console" aria-label="Keeper transcript">
            <div className="demo-console-header">
              <div>
                <span>Live transcript</span>
                <strong>Keeper online</strong>
              </div>
              <button type="button" onClick={() => setEnding('manual')} className="demo-queue-button">
                Join waitlist
              </button>
            </div>

            <div className="demo-transcript" ref={transcriptRef}>
              {messages.map((message) => (
                <article className={`demo-message ${message.role}`} key={message.id}>
                  <div className="demo-message-meta">{message.meta}</div>
                  <p>{message.text}</p>
                </article>
              ))}
              {thinking && (
                <article className="demo-message keeper thinking">
                  <div className="demo-message-meta">Keeper</div>
                  <p>The Keeper consults the file...</p>
                </article>
              )}
            </div>

            <div className="demo-suggestions" aria-label="Suggested actions">
              {suggestions.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  onClick={() => suggestion === 'Join the waitlist' ? setEnding('completed') : submitTurn(suggestion)}
                  disabled={thinking || Boolean(ending)}
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="demo-input-row">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={thinking || Boolean(ending)}
                placeholder="Tell the Keeper what you do..."
                aria-label="Tell the Keeper what you do"
              />
              <button type="submit" disabled={thinking || Boolean(ending) || !input.trim()}>
                Send
              </button>
            </form>
          </section>
        </section>
      </main>

      {ending && (
        <div className="demo-modal-backdrop" role="presentation">
          <section className="demo-modal" role="dialog" aria-modal="true" aria-labelledby="demo-modal-title">
            <div className="demo-modal-stamp">{ending === 'completed' ? 'Entered' : 'Filed'}</div>
            <div className="demo-dossier-label">Preview complete</div>
            <h2 id="demo-modal-title">
              {ending === 'completed' ? 'The archive opens.' : 'The Keeper closes the preview file.'}
            </h2>
            <p>
              Barri is opening access in controlled batches. Leave your email and the Bureau will call
              you when the next table is ready.
            </p>

            {waitlistState === 'success' ? (
              <div className="demo-success">
                <strong>Filed under waiting list.</strong>
                <span>We have your address. The next letter will not be blank.</span>
                <Link href="/auth/register">Create an account now</Link>
              </div>
            ) : (
              <form onSubmit={submitWaitlist} className="demo-waitlist-form">
                <label htmlFor="waitlist-email">Investigator email</label>
                <div>
                  <input
                    id="waitlist-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    placeholder="investigator@example.com"
                    autoComplete="email"
                  />
                  <button type="submit" disabled={waitlistState === 'loading'}>
                    {waitlistState === 'loading' ? 'Filing...' : 'Join queue'}
                  </button>
                </div>
                {waitlistState === 'error' && <span className="demo-form-error">{waitlistError}</span>}
              </form>
            )}

            <div className="demo-modal-links">
              <button type="button" onClick={() => setEnding(null)}>Return to file</button>
              <Link href="/auth/register">Register instead</Link>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
