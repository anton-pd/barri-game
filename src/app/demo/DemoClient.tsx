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

interface DemoState {
  doorInspected: boolean;
  hasPin: boolean;
  hasPassphrase: boolean;
  archiveOpen: boolean;
  lastRoll: number | null;
  lastRollTarget: number | null;
}

interface KeeperReply {
  text: string;
  meta?: string;
  completed?: boolean;
  state: DemoState;
}

const MAX_USER_MESSAGES = 10;
const DEMO_SECONDS = 5 * 60;

const initialState: DemoState = {
  doorInspected: false,
  hasPin: false,
  hasPassphrase: false,
  archiveOpen: false,
  lastRoll: null,
  lastRollTarget: null,
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

function normalize(input: string) {
  return input.trim().toLowerCase();
}

function hasAny(input: string, words: string[]) {
  return words.some((word) => input.includes(word));
}

function resolveKeeperTurn(input: string, current: DemoState): KeeperReply {
  const text = normalize(input);
  const next: DemoState = { ...current };

  if (hasAny(text, ['pin', 'pick', 'lockpick', 'unlock']) && next.hasPin) {
    const roll = Math.ceil(Math.random() * 60);
    next.lastRoll = roll;
    next.lastRollTarget = 60;
    next.archiveOpen = true;
    return {
      state: next,
      completed: true,
      meta: `d100 ${roll} <= 60`,
      text: `The silver pin turns once, twice, then disappears into the lock as if swallowed. The Keeper calls for a Locksmith check. ${roll}. Success. Behind the door, green-shaded lamps wake one by one. The archive admits you.`,
    };
  }

  if (hasAny(text, ['passphrase', 'phrase', 'silence', 'spine', 'say', 'whisper']) && next.hasPassphrase) {
    next.archiveOpen = true;
    return {
      state: next,
      completed: true,
      meta: 'Social clue resolved',
      text: 'You speak the phrase into the keyhole: "The silence has a spine." The brass warms under your breath. Somewhere inside, a clerk who died in 1904 stamps APPROVED. The door opens.',
    };
  }

  if (hasAny(text, ['search', 'desk', 'ledger', 'pocket', 'coat', 'drawer', 'table'])) {
    next.hasPin = true;
    return {
      state: next,
      meta: 'Item gained',
      text: 'You search the abandoned intake desk. Under a blotter, beside three unpaid telegrams, you find a silver filing pin filed to a wicked point. It is too deliberate to be accidental.',
    };
  }

  if (hasAny(text, ['listen', 'keyhole', 'hear', 'sound', 'ear'])) {
    next.hasPassphrase = true;
    return {
      state: next,
      meta: 'Clue discovered',
      text: 'You lean close to the keyhole. A typewriter clacks inside the sealed room: two strokes, a pause, then a whisper. "The silence has a spine." The Keeper records the phrase before you can forget it.',
    };
  }

  if (hasAny(text, ['inspect', 'look', 'examine', 'door', 'brass', 'plaque'])) {
    next.doorInspected = true;
    return {
      state: next,
      meta: 'Location detail',
      text: 'The brass plaque has been polished by nervous thumbs: ARCHIVE 7. Beneath it, scratched into the wood, someone wrote: LISTEN FIRST, FORCE LAST. The lock is narrow enough for a filing pin.',
    };
  }

  if (hasAny(text, ['open', 'enter', 'inside', 'go in'])) {
    if (next.hasPin) {
      const roll = Math.ceil(Math.random() * 60);
      next.lastRoll = roll;
      next.lastRollTarget = 60;
      next.archiveOpen = true;
      return {
        state: next,
        completed: true,
        meta: `d100 ${roll} <= 60`,
        text: `You set the silver pin into the narrow lock and breathe out. The Keeper calls for a Locksmith check. ${roll}. Success. The latch gives, and the archive exhales paper dust and cold candle smoke.`,
      };
    }

    return {
      state: next,
      meta: 'Blocked',
      text: 'You press your shoulder to the door. It does not move. The Keeper notes the attempt, then the silence after it. You will need a clue, a tool, or a phrase the archive recognises.',
    };
  }

  return {
    state: next,
    meta: 'Keeper improvises',
    text: 'The Keeper lets the moment breathe. Dust gathers in the seams of the door. Somewhere behind it, paper shifts without hands. Try reading the room: inspect the door, listen at the keyhole, or search the desk.',
  };
}

function getSuggestions(state: DemoState) {
  if (state.archiveOpen) return ['Join the waitlist'];
  if (state.hasPin) return ['Use the silver pin on the lock', 'Listen at the keyhole', 'Open the archive door'];
  if (state.hasPassphrase) return ['Say the passphrase into the keyhole', 'Search the intake desk', 'Inspect the brass door'];
  if (state.doorInspected) return ['Search the intake desk', 'Listen at the keyhole', 'Try to open the door'];
  return ['Inspect the brass door', 'Search the intake desk', 'Listen at the keyhole'];
}

function countClues(state: DemoState) {
  return [state.doorInspected, state.hasPin, state.hasPassphrase].filter(Boolean).length;
}

export default function DemoClient() {
  const [messages, setMessages] = useState<DemoMessage[]>(initialMessages);
  const [demoState, setDemoState] = useState<DemoState>(initialState);
  const [input, setInput] = useState('');
  const [userMessages, setUserMessages] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [ending, setEnding] = useState<'completed' | 'message_limit' | 'manual' | null>(null);
  const [email, setEmail] = useState('');
  const [waitlistState, setWaitlistState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [waitlistError, setWaitlistError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(DEMO_SECONDS);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const suggestions = useMemo(() => getSuggestions(demoState), [demoState]);
  const clueCount = countClues(demoState);

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

  function submitTurn(value: string) {
    const trimmed = value.trim();
    if (!trimmed || thinking || ending) return;

    const nextCount = userMessages + 1;
    setUserMessages(nextCount);
    setInput('');
    addMessage({ role: 'player', meta: 'You', text: trimmed });
    setThinking(true);

    window.setTimeout(() => {
      const reply = resolveKeeperTurn(trimmed, demoState);
      setDemoState(reply.state);
      addMessage({ role: 'keeper', meta: reply.meta ?? 'Keeper', text: reply.text });
      setThinking(false);

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
    }, 560);
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
          notes: `Archive demo clues=${clueCount}; archiveOpen=${demoState.archiveOpen}`,
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
              <div className={demoState.doorInspected ? 'found' : ''}>Brass door inspected</div>
              <div className={demoState.hasPin ? 'found' : ''}>Silver filing pin found</div>
              <div className={demoState.hasPassphrase ? 'found' : ''}>Passphrase overheard</div>
              <div className={demoState.archiveOpen ? 'found' : ''}>Archive opened</div>
            </div>

            <div className="demo-roll">
              <span>Last check</span>
              {demoState.lastRoll && demoState.lastRollTarget ? (
                <strong>d100: {demoState.lastRoll} {'<='} {demoState.lastRollTarget}</strong>
              ) : (
                <strong>Awaiting pressure</strong>
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
