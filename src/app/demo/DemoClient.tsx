'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type DemoRole = 'keeper' | 'player' | 'system';
type DemoLang = 'en' | 'uk' | 'es';
type EndingReason = 'completed' | 'message_limit' | 'guard' | 'manual';
type ClosedReason = Exclude<EndingReason, 'manual'>;

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
const DEMO_SECONDS = 15 * 60;

const LANGS: { code: DemoLang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'uk', label: 'УК' },
  { code: 'es', label: 'ES' },
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

function createInitialWorldState(copy: DemoCopy): DemoWorldState {
  return {
    act: 1,
    currentLocation: 'archive_threshold',
    visitedLocations: ['archive_threshold', 'intake_desk'],
    discoveredClues: [],
    npcRelations: { archive_echo: 'unknown' },
    summary: copy.stateSummary,
    openThreads: [copy.objective],
    playerNotes: [],
    totalMessageCount: 0,
  };
}

function createInitialMessages(copy: DemoCopy): DemoMessage[] {
  return [
    {
      id: 'intro',
      role: 'keeper',
      meta: copy.keeper,
      text: copy.intro,
    },
    {
      id: 'briefing',
      role: 'system',
      meta: copy.objectiveLabel,
      text: copy.briefing,
    },
  ];
}

function countClues(flags: DemoFlags) {
  return [flags.doorInspected, flags.hasPin, flags.hasPassphrase].filter(Boolean).length;
}

function createAnonymousSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `demo:${crypto.randomUUID()}`;
  }
  return `demo:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function DemoClient() {
  const [lang, setLang] = useState<DemoLang>('en');
  const copy = DEMO_COPY[lang];
  const [messages, setMessages] = useState<DemoMessage[]>(() => createInitialMessages(DEMO_COPY.en));
  const [worldState, setWorldState] = useState<DemoWorldState>(() => createInitialWorldState(DEMO_COPY.en));
  const [players, setPlayers] = useState<DemoPlayer[] | null>(null);
  const [input, setInput] = useState('');
  const [userMessages, setUserMessages] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [ending, setEnding] = useState<EndingReason | null>(null);
  const [chatClosedReason, setChatClosedReason] = useState<ClosedReason | null>(null);
  const [email, setEmail] = useState('');
  const [waitlistState, setWaitlistState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [waitlistError, setWaitlistError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(DEMO_SECONDS);
  const [hasStarted, setHasStarted] = useState(false);
  const [showDossier, setShowDossier] = useState(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const anonymousSessionRef = useRef('');

  const flags = useMemo(() => getFlags(worldState, players), [worldState, players]);
  const clueCount = countClues(flags);
  const pendingRoll = worldState.pendingRollResult;

  useEffect(() => {
    if (!anonymousSessionRef.current) {
      anonymousSessionRef.current = createAnonymousSessionId();
    }

    const queryLang = new URLSearchParams(window.location.search).get('lang');
    if (queryLang === 'uk' || queryLang === 'es' || queryLang === 'en') {
      resetDemo(queryLang);
    }
  }, []);

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, thinking]);

  useEffect(() => {
    if (!hasStarted || chatClosedReason) return undefined;
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => Math.max(value - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [hasStarted, chatClosedReason]);

  useEffect(() => {
    if (secondsLeft !== 0 || chatClosedReason) return;
    setChatClosedReason('guard');
    setEnding('guard');
    addMessage({
      role: 'system',
      meta: copy.guard.meta,
      text: copy.guard.notice,
    });
  }, [secondsLeft, chatClosedReason, copy]);

  function resetDemo(nextLang: DemoLang) {
    const nextCopy = DEMO_COPY[nextLang];
    setLang(nextLang);
    setMessages(createInitialMessages(nextCopy));
    setWorldState(createInitialWorldState(nextCopy));
    setPlayers(null);
    setInput('');
    setUserMessages(0);
    setThinking(false);
    setEnding(null);
    setChatClosedReason(null);
    setWaitlistState('idle');
    setWaitlistError('');
    setSecondsLeft(DEMO_SECONDS);
    setHasStarted(false);
  }

  function addMessage(message: Omit<DemoMessage, 'id'>) {
    setMessages((prev) => [
      ...prev,
      {
        ...message,
        id: `${Date.now()}-${prev.length}`,
      },
    ]);
  }

  async function submitTurn(value: string, options?: { allowPendingRoll?: boolean }) {
    const trimmed = value.trim();
    if (!trimmed || thinking || chatClosedReason || (pendingRoll && !options?.allowPendingRoll)) return;

    const nextCount = userMessages + 1;
    const history = messages
      .filter((message): message is DemoMessage & { role: 'keeper' | 'player' } =>
        message.role === 'keeper' || message.role === 'player'
      )
      .map((message) => ({ role: message.role, text: message.text }));

    setUserMessages(nextCount);
    setHasStarted(true);
    setInput('');
    addMessage({ role: 'player', meta: 'You', text: trimmed });
    setThinking(true);
    if (!anonymousSessionRef.current) {
      anonymousSessionRef.current = createAnonymousSessionId();
    }

    try {
      const res = await fetch('/api/demo/keeper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history,
          worldState,
          players,
          language: lang,
          anonymousSessionId: anonymousSessionRef.current,
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
        setChatClosedReason('completed');
        setEnding('completed');
      } else if (nextCount >= MAX_USER_MESSAGES) {
        addMessage({
          role: 'system',
          meta: copy.messageLimit.meta,
          text: copy.messageLimit.notice,
        });
        setChatClosedReason('message_limit');
        setEnding('message_limit');
      }
    } catch (error) {
      addMessage({
        role: 'system',
        meta: copy.connection.meta,
        text: error instanceof Error
          ? `${copy.connection.errorPrefix} ${error.message}`
          : copy.connection.error,
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
          locale: lang,
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

  function closeModal() {
    setEnding(null);
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  return (
    <>
      <main className="demo-shell">
        <header className="demo-topbar">
          <Link href="/" className="demo-brand" aria-label={copy.backLabel}>
            <span className="demo-seal">B</span>
            <span>Barri</span>
          </Link>
          <div className="demo-top-actions">
            <span className="demo-file">{copy.fileLabel}</span>
            <div className="demo-lang-switcher" aria-label={copy.languageLabel}>
              {LANGS.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  className={item.code === lang ? 'active' : ''}
                  onClick={() => resetDemo(item.code)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <Link href="/auth/login" className="demo-login">{copy.signIn}</Link>
          </div>
        </header>

        <section className="demo-stage" aria-label={copy.stageLabel}>
          {showDossier && (
            <button
              type="button"
              className="demo-dossier-scrim"
              onClick={() => setShowDossier(false)}
              aria-label={copy.closeCaseFile}
            />
          )}
          <aside
            id="demo-case-file"
            className={`demo-dossier${showDossier ? ' demo-dossier--open' : ''}`}
            aria-label={copy.caseStatusLabel}
          >
            <button
              type="button"
              className="demo-dossier-close"
              onClick={() => setShowDossier(false)}
              aria-label={copy.closeCaseFile}
            >
              x
            </button>
            <div className="demo-dossier-label">{copy.previewLabel}</div>
            <h1>{copy.title}</h1>
            <p>
              {copy.description}
            </p>

            <div className="demo-progress" aria-label={copy.progressLabel}>
              <div>
                <span>{copy.entriesLabel}</span>
                <strong>{userMessages}/{MAX_USER_MESSAGES}</strong>
              </div>
              <div>
                <span>{copy.clockLabel}</span>
                <strong>{minutes}:{seconds}</strong>
              </div>
              <div>
                <span>{copy.cluesLabel}</span>
                <strong>{clueCount}/3</strong>
              </div>
            </div>

            <div className="demo-evidence">
              <div className={flags.doorInspected ? 'found' : ''}>{copy.evidence.door}</div>
              <div className={flags.hasPin ? 'found' : ''}>{copy.evidence.pin}</div>
              <div className={flags.hasPassphrase ? 'found' : ''}>{copy.evidence.passphrase}</div>
              <div className={flags.archiveOpen ? 'found' : ''}>{copy.evidence.archive}</div>
            </div>

            <div className="demo-roll">
              <span>{copy.lastCheckLabel}</span>
              {worldState.pendingRollResult ? (
                <strong>{worldState.pendingRollResult.skillName} {'<='} {worldState.pendingRollResult.goodThreshold}</strong>
              ) : flags.archiveOpen ? (
                <strong>{copy.resolvedLabel}</strong>
              ) : (
                <strong>{copy.keeperDrivenLabel}</strong>
              )}
            </div>
          </aside>

          <section className="demo-console" aria-label={copy.transcriptLabel}>
            <div className="demo-console-header">
              <div>
                <span>{copy.liveTranscriptLabel}</span>
                <strong>{copy.keeperOnlineLabel}</strong>
              </div>
              <div className="demo-console-actions">
                <button
                  type="button"
                  onClick={() => setShowDossier(true)}
                  className="demo-file-button"
                  aria-controls="demo-case-file"
                  aria-expanded={showDossier}
                >
                  {copy.caseFileButton}
                </button>
                <button type="button" onClick={() => setEnding('manual')} className="demo-queue-button">
                  {copy.joinWaitlist}
                </button>
              </div>
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
                  <div className="demo-message-meta">{copy.keeper}</div>
                  <p>{copy.thinking}</p>
                </article>
              )}
            </div>

            {pendingRoll && (
              <DemoDiceRoller
                key={`${pendingRoll.skillName}-${pendingRoll.goodThreshold}-${pendingRoll.context}`}
                pendingRoll={pendingRoll}
                copy={copy.dice}
                disabled={thinking || Boolean(chatClosedReason)}
                onResult={(result) => submitTurn(String(result), { allowPendingRoll: true })}
              />
            )}

            {userMessages === 0 && (
              <section className="demo-suggestions" aria-label={copy.suggestionsLabel}>
                <p>{copy.suggestionsLabel} <span>{copy.suggestionsHint}</span></p>
                <div>
                  {copy.suggestions.initial.map((action) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => submitTurn(action)}
                      disabled={thinking || Boolean(chatClosedReason) || Boolean(pendingRoll)}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <form onSubmit={handleSubmit} className="demo-input-row">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={thinking || Boolean(chatClosedReason) || Boolean(pendingRoll)}
                placeholder={pendingRoll ? copy.rollInputPlaceholder : copy.inputPlaceholder}
                aria-label={copy.inputLabel}
              />
              <button type="submit" disabled={thinking || Boolean(chatClosedReason) || Boolean(pendingRoll) || !input.trim()}>
                {copy.send}
              </button>
            </form>
            {chatClosedReason && (
              <div className="demo-closed-notice">
                {copy.closed[chatClosedReason]}
              </div>
            )}
          </section>
        </section>
      </main>

      {ending && (
        <div className="demo-modal-backdrop" role="presentation">
          <section className="demo-modal" role="dialog" aria-modal="true" aria-labelledby="demo-modal-title">
            <div className="demo-modal-stamp">{copy.modal[ending].stamp}</div>
            <div className="demo-dossier-label">{copy.modal.previewComplete}</div>
            <h2 id="demo-modal-title">
              {copy.modal[ending].title}
            </h2>
            <p>
              {copy.modal[ending].body}
            </p>

            {waitlistState === 'success' ? (
              <div className="demo-success">
                <strong>{copy.waitlist.successTitle}</strong>
                <span>{copy.waitlist.successBody}</span>
              </div>
            ) : (
              <form onSubmit={submitWaitlist} className="demo-waitlist-form">
                <label htmlFor="waitlist-email">{copy.waitlist.emailLabel}</label>
                <div>
                  <input
                    id="waitlist-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    placeholder={copy.waitlist.placeholder}
                    autoComplete="email"
                  />
                  <button type="submit" disabled={waitlistState === 'loading'}>
                    {waitlistState === 'loading' ? copy.waitlist.loading : copy.waitlist.submit}
                  </button>
                </div>
                {waitlistState === 'error' && <span className="demo-form-error">{waitlistError}</span>}
                <p className="demo-waitlist-privacy">
                  {copy.waitlist.privacy.before}{' '}
                  <Link href="/privacy">{copy.waitlist.privacy.privacy}</Link>
                  {copy.waitlist.privacy.between}
                  <Link href="/terms">{copy.waitlist.privacy.terms}</Link>
                  {copy.waitlist.privacy.after}
                </p>
              </form>
            )}

            <div className="demo-modal-links">
              <button type="button" onClick={closeModal}>
                {chatClosedReason ? copy.modal.reviewFile : copy.modal.returnToFile}
              </button>
              <Link href="/auth/login">{copy.modal.alreadyCleared}</Link>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

interface DiceCopy {
  title: string;
  threshold: string;
  contextFallback: string;
  tens: string;
  units: string;
  result: string;
  roll: string;
  rolling: string;
  success: string;
  fail: string;
  send: (result: number) => string;
}

function DemoDiceRoller({
  pendingRoll,
  copy,
  disabled,
  onResult,
}: {
  pendingRoll: NonNullable<DemoWorldState['pendingRollResult']>;
  copy: DiceCopy;
  disabled: boolean;
  onResult: (result: number) => void;
}) {
  const [phase, setPhase] = useState<'idle' | 'rolling' | 'done'>('idle');
  const [display, setDisplay] = useState(0);
  const [finalResult, setFinalResult] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  function roll() {
    if (phase !== 'idle' || disabled) return;

    const result = Math.floor(Math.random() * 100) + 1;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setDisplay(result);
      setFinalResult(result);
      setPhase('done');
      return;
    }

    setPhase('rolling');
    let elapsed = 0;
    let interval = 44;

    function tick() {
      elapsed += interval;
      setDisplay(Math.floor(Math.random() * 100) + 1);
      if (elapsed >= 1450) {
        setDisplay(result);
        setFinalResult(result);
        setPhase('done');
        return;
      }
      if (elapsed > 950) interval = Math.min(180, interval * 1.24);
      timerRef.current = window.setTimeout(tick, interval);
    }

    timerRef.current = window.setTimeout(tick, interval);
  }

  const isSuccess = finalResult !== null && finalResult <= pendingRoll.goodThreshold;
  const tens = display === 100 ? '00' : String(Math.floor(display / 10) * 10).padStart(2, '0');
  const units = display === 100 ? '0' : String(display % 10);

  return (
    <section className="demo-dice-panel" aria-live="polite">
      <div className="demo-dice-header">
        <span>{copy.title}</span>
        <strong>{pendingRoll.skillName}</strong>
      </div>
      <p>
        {copy.threshold} <b>{pendingRoll.goodThreshold}</b>
        {' · '}
        {pendingRoll.context || copy.contextFallback}
      </p>

      <div className="demo-dice-row">
        <div className="demo-die">
          <strong>{phase === 'idle' ? '--' : tens}</strong>
          <span>{copy.tens}</span>
        </div>
        <span className="demo-dice-plus">+</span>
        <div className="demo-die">
          <strong>{phase === 'idle' ? '-' : units}</strong>
          <span>{copy.units}</span>
        </div>
        {phase === 'done' && finalResult !== null && (
          <>
            <span className="demo-dice-plus">=</span>
            <div className={`demo-die demo-die-result ${isSuccess ? 'success' : 'fail'}`}>
              <strong>{finalResult}</strong>
              <span>{isSuccess ? copy.success : copy.fail}</span>
            </div>
          </>
        )}
      </div>

      <div className="demo-dice-actions">
        {phase === 'idle' && (
          <button type="button" onClick={roll} disabled={disabled}>
            {copy.roll}
          </button>
        )}
        {phase === 'rolling' && <span>{copy.rolling}</span>}
        {phase === 'done' && finalResult !== null && (
          <button type="button" onClick={() => onResult(finalResult)} disabled={disabled}>
            {copy.send(finalResult)}
          </button>
        )}
      </div>
    </section>
  );
}

const DEMO_COPY = {
  en: {
    keeper: 'Case Curator',
    objective: 'Find a way into the secret archive',
    objectiveLabel: 'Objective',
    stateSummary:
      'The investigator stands before Archive 7 after midnight. The door is sealed, but the corridor offers clues for a careful mind.',
    intro:
      'Rain needles the high windows of the Bureau. You stand before a sealed archive door marked PARANORMAL CASES DIVISION. Brass hinges. No handle. A thin keyhole listens back.',
    briefing:
      'Find a way into the secret archive. Tell the Case Curator what you do in your own words.',
    backLabel: 'Back to Barri landing',
    fileLabel: 'Demo file / Archive 7',
    languageLabel: 'Demo language',
    signIn: 'Sign in',
    stageLabel: 'Playable instant demo',
    caseStatusLabel: 'Case status',
    caseFileButton: 'Case file',
    closeCaseFile: 'Close case file',
    previewLabel: '15-minute preview',
    title: 'The Archive Door',
    description:
      'You have 15 minutes before the next guard patrol. Get inside the secret Bureau archive before the corridor catches you.',
    progressLabel: 'Demo progress',
    entriesLabel: 'Entries',
    clockLabel: 'Patrol',
    cluesLabel: 'Clues',
    evidence: {
      door: 'Brass door inspected',
      pin: 'Silver filing pin found',
      passphrase: 'Passphrase overheard',
      archive: 'Archive opened',
    },
    lastCheckLabel: 'Last check',
    resolvedLabel: 'Resolved',
    keeperDrivenLabel: 'Case Curator driven',
    transcriptLabel: 'Case Curator transcript',
    liveTranscriptLabel: 'Live transcript',
    keeperOnlineLabel: 'Case Curator online',
    joinWaitlist: 'Join waitlist',
    thinking: 'The Case Curator consults the file...',
    suggestionsLabel: 'Suggested actions',
    suggestionsHint: 'or write anything',
    suggestions: {
      waitlist: 'Join the waitlist',
      initial: ['Inspect the brass door', 'Search the intake desk', 'Listen at the keyhole'],
      doorInspected: ['Search the intake desk', 'Listen at the keyhole', 'Try to open the door'],
      hasPin: ['Use the silver pin on the lock', 'Listen at the keyhole', 'Open the archive door'],
      hasPassphrase: ['Say the passphrase into the keyhole', 'Search the intake desk', 'Inspect the brass door'],
    },
    inputPlaceholder: 'Tell the Case Curator what you do...',
    rollInputPlaceholder: 'Resolve the d100 check above...',
    inputLabel: 'Tell the Case Curator what you do',
    send: 'Send',
    guard: {
      meta: 'Guard patrol',
      notice:
        'Heavy footsteps enter the corridor. The night guard finds you outside Archive 7 before the door yields. The preview file is closed.',
    },
    messageLimit: {
      meta: 'Archive notice',
      notice: 'The Case Curator closes the preview file at ten entries. The full dossier waits beyond access.',
    },
    connection: {
      meta: 'Connection',
      error: 'The Case Curator cannot reach the file right now.',
      errorPrefix: 'The Case Curator cannot reach the file right now:',
    },
    closed: {
      completed: 'The archive file is complete. Join the waiting list to continue beyond the demo.',
      message_limit: 'The preview is closed after ten entries. Join the waiting list for the full archive.',
      guard: 'The guard has ended this attempt. The transcript is preserved for review.',
    },
    dice: {
      title: 'd100 check',
      threshold: 'Need',
      contextFallback: 'The Case Curator is waiting for the result.',
      tens: 'tens',
      units: 'units',
      result: 'result',
      roll: 'Roll d100',
      rolling: 'The dice are rolling...',
      success: 'success',
      fail: 'fail',
      send: (result: number) => `Send ${result}`,
    },
    modal: {
      previewComplete: 'Preview complete',
      returnToFile: 'Return to file',
      reviewFile: 'Review file',
      alreadyCleared: 'Already cleared?',
      completed: {
        stamp: 'Entered',
        title: 'The archive opens.',
        body: 'Barri is opening access in controlled batches. Leave your email and the Bureau will call you when the next table is ready.',
      },
      message_limit: {
        stamp: 'Filed',
        title: 'The Case Curator closes the preview file.',
        body: 'Ten entries are enough to prove the file is alive. Join the queue and the Bureau will summon you for the full case.',
      },
      guard: {
        stamp: 'Caught',
        title: 'The guard finds you.',
        body: 'The patrol reaches the corridor before Archive 7 opens. Leave your email and try the full case when access clears.',
      },
      manual: {
        stamp: 'Queue',
        title: 'Join the waiting list.',
        body: 'Barri is opening access in controlled batches. Leave your email and the Bureau will call you when the next table is ready.',
      },
    },
    waitlist: {
      emailLabel: 'Investigator email',
      placeholder: 'investigator@example.com',
      loading: 'Filing...',
      submit: 'Join queue',
      privacy: {
        before: 'We use your email to manage this waiting-list request. See our',
        privacy: 'Privacy Policy',
        between: ' and ',
        terms: 'Terms',
        after: '.',
      },
      successTitle: 'Filed under waiting list.',
      successBody: 'We have your address. The next letter will not be blank.',
    },
  },
  uk: {
    keeper: 'Куратор справи',
    objective: 'Знайти шлях у секретний архів',
    objectiveLabel: 'Мета',
    stateSummary:
      'Слідчий стоїть перед Архівом 7 після опівночі. Двері запечатані, але коридор залишив підказки для уважного ока.',
    intro:
      'Дощ січе високі вікна Бюро. Перед вами запечатані архівні двері з написом: ВІДДІЛ ПАРАНОРМАЛЬНИХ СПРАВ. Латунні петлі. Жодної ручки. Тонка замкова щілина ніби слухає у відповідь.',
    briefing:
      'Знайдіть шлях у секретний архів. Напишіть Куратору справи своїми словами, що робите.',
    backLabel: 'Повернутися на лендинг Barri',
    fileLabel: 'Демо-файл / Архів 7',
    languageLabel: 'Мова демо',
    signIn: 'Увійти',
    stageLabel: 'Ігрове instant demo',
    caseStatusLabel: 'Стан справи',
    caseFileButton: 'Справа',
    closeCaseFile: 'Закрити справу',
    previewLabel: '15-хвилинне превʼю',
    title: 'Двері Архіву',
    description:
      'У вас 15 хвилин до наступного обходу сторожа. Потрапте до секретного архіву Бюро, поки коридор вас не видав.',
    progressLabel: 'Прогрес демо',
    entriesLabel: 'Записи',
    clockLabel: 'Обхід',
    cluesLabel: 'Підказки',
    evidence: {
      door: 'Латунні двері оглянуто',
      pin: 'Срібну архівну шпильку знайдено',
      passphrase: 'Парольну фразу почуто',
      archive: 'Архів відкрито',
    },
    lastCheckLabel: 'Остання перевірка',
    resolvedLabel: 'Вирішено',
    keeperDrivenLabel: 'Веде Куратор справи',
    transcriptLabel: 'Протокол Куратора справи',
    liveTranscriptLabel: 'Живий протокол',
    keeperOnlineLabel: 'Куратор справи на звʼязку',
    joinWaitlist: 'Стати в чергу',
    thinking: 'Куратор справи звіряється з файлом...',
    suggestionsLabel: 'Запропоновані дії',
    suggestionsHint: 'або напишіть будь-що',
    suggestions: {
      waitlist: 'Стати в чергу',
      initial: ['Оглянути латунні двері', 'Обшукати стіл реєстрації', 'Послухати біля замкової щілини'],
      doorInspected: ['Обшукати стіл реєстрації', 'Послухати біля замкової щілини', 'Спробувати відчинити двері'],
      hasPin: ['Скористатися срібною шпилькою', 'Послухати біля замкової щілини', 'Відчинити двері архіву'],
      hasPassphrase: ['Прошепотіти фразу в замкову щілину', 'Обшукати стіл реєстрації', 'Оглянути латунні двері'],
    },
    inputPlaceholder: 'Скажіть Куратору справи, що ви робите...',
    rollInputPlaceholder: 'Спершу вирішіть d100 перевірку вище...',
    inputLabel: 'Скажіть Куратору справи, що ви робите',
    send: 'Надіслати',
    guard: {
      meta: 'Обхід сторожа',
      notice:
        'Важкі кроки входять у коридор. Нічний сторож застає вас біля Архіву 7 до того, як двері піддались. Демо-файл закрито.',
    },
    messageLimit: {
      meta: 'Повідомлення архіву',
      notice: 'Куратор справи закриває превʼю після десяти записів. Повне досьє чекає після доступу.',
    },
    connection: {
      meta: 'Звʼязок',
      error: 'Куратор справи не може дістатися файлу зараз.',
      errorPrefix: 'Куратор справи не може дістатися файлу зараз:',
    },
    closed: {
      completed: 'Архівний файл завершено. Станьте в чергу, щоб продовжити після демо.',
      message_limit: 'Превʼю закрито після десяти записів. Станьте в чергу до повного архіву.',
      guard: 'Сторож завершив цю спробу. Протокол збережено для перегляду.',
    },
    dice: {
      title: 'd100 перевірка',
      threshold: 'Потрібно',
      contextFallback: 'Куратор справи чекає результат.',
      tens: 'десятки',
      units: 'одиниці',
      result: 'результат',
      roll: 'Кинути d100',
      rolling: 'Кубики котяться...',
      success: 'успіх',
      fail: 'провал',
      send: (result: number) => `Надіслати ${result}`,
    },
    modal: {
      previewComplete: 'Превʼю завершено',
      returnToFile: 'Повернутися до файлу',
      reviewFile: 'Переглянути файл',
      alreadyCleared: 'Вже маєте доступ?',
      completed: {
        stamp: 'Вхід',
        title: 'Архів відкривається.',
        body: 'Barri відкриває доступ контрольованими хвилями. Залиште email, і Бюро викличе вас, коли наступний стіл буде готовий.',
      },
      message_limit: {
        stamp: 'Закрито',
        title: 'Куратор справи закриває превʼю.',
        body: 'Десяти записів достатньо, щоб довести: файл живий. Станьте в чергу, і Бюро викличе вас до повної справи.',
      },
      guard: {
        stamp: 'Спіймано',
        title: 'Сторож вас знаходить.',
        body: 'Обхід доходить до коридору раніше, ніж Архів 7 відчиняється. Залиште email і спробуйте повну справу після доступу.',
      },
      manual: {
        stamp: 'Черга',
        title: 'Стати в чергу.',
        body: 'Barri відкриває доступ контрольованими хвилями. Залиште email, і Бюро викличе вас, коли наступний стіл буде готовий.',
      },
    },
    waitlist: {
      emailLabel: 'Email слідчого',
      placeholder: 'investigator@example.com',
      loading: 'Підшиваємо...',
      submit: 'Стати в чергу',
      privacy: {
        before: 'Ми використовуємо email, щоб опрацювати цю заявку до списку очікування. Деталі — у',
        privacy: 'Політиці конфіденційності',
        between: ' та ',
        terms: 'Умовах',
        after: '.',
      },
      successTitle: 'Підшито до списку очікування.',
      successBody: 'Адресу прийнято. Наступний лист не буде порожнім.',
    },
  },
  es: {
    keeper: 'Curador del caso',
    objective: 'Encontrar la entrada al archivo secreto',
    objectiveLabel: 'Objetivo',
    stateSummary:
      'El investigador está frente al Archivo 7 después de medianoche. La puerta está sellada, pero el corredor guarda pistas para quien mire con cuidado.',
    intro:
      'La lluvia golpea los altos ventanales del Buró. Estás ante una puerta de archivo sellada: DIVISIÓN DE CASOS PARANORMALES. Bisagras de latón. Sin pomo. Una cerradura fina parece escuchar.',
    briefing:
      'Encuentra la forma de entrar al archivo secreto. Dile al Curador qué haces con tus propias palabras.',
    backLabel: 'Volver al inicio de Barri',
    fileLabel: 'Archivo demo / Archivo 7',
    languageLabel: 'Idioma de la demo',
    signIn: 'Entrar',
    stageLabel: 'Demo jugable',
    caseStatusLabel: 'Estado del expediente',
    caseFileButton: 'Expediente',
    closeCaseFile: 'Cerrar expediente',
    previewLabel: 'Vista de 15 minutos',
    title: 'La Puerta del Archivo',
    description:
      'Tienes 15 minutos antes de la próxima ronda del guardia. Entra al archivo secreto del Buró antes de que el corredor te delate.',
    progressLabel: 'Progreso de la demo',
    entriesLabel: 'Entradas',
    clockLabel: 'Ronda',
    cluesLabel: 'Pistas',
    evidence: {
      door: 'Puerta de latón inspeccionada',
      pin: 'Alfiler de archivo encontrado',
      passphrase: 'Contraseña escuchada',
      archive: 'Archivo abierto',
    },
    lastCheckLabel: 'Última prueba',
    resolvedLabel: 'Resuelta',
    keeperDrivenLabel: 'Guía del Curador',
    transcriptLabel: 'Transcripción del Curador',
    liveTranscriptLabel: 'Transcripción en vivo',
    keeperOnlineLabel: 'Curador en línea',
    joinWaitlist: 'Unirse a la lista',
    thinking: 'El Curador del caso consulta el expediente...',
    suggestionsLabel: 'Acciones sugeridas',
    suggestionsHint: 'o escribe lo que quieras',
    suggestions: {
      waitlist: 'Unirse a la lista',
      initial: ['Inspeccionar la puerta de latón', 'Registrar el escritorio', 'Escuchar por la cerradura'],
      doorInspected: ['Registrar el escritorio', 'Escuchar por la cerradura', 'Intentar abrir la puerta'],
      hasPin: ['Usar el alfiler en la cerradura', 'Escuchar por la cerradura', 'Abrir la puerta del archivo'],
      hasPassphrase: ['Susurrar la contraseña en la cerradura', 'Registrar el escritorio', 'Inspeccionar la puerta de latón'],
    },
    inputPlaceholder: 'Dile al Curador qué haces...',
    rollInputPlaceholder: 'Resuelve primero la prueba d100...',
    inputLabel: 'Dile al Curador qué haces',
    send: 'Enviar',
    guard: {
      meta: 'Ronda del guardia',
      notice:
        'Pasos pesados entran en el corredor. El guardia nocturno te encuentra ante el Archivo 7 antes de que la puerta ceda. La demo queda cerrada.',
    },
    messageLimit: {
      meta: 'Aviso del archivo',
      notice: 'El Curador del caso cierra la vista previa tras diez entradas. El expediente completo espera tras el acceso.',
    },
    connection: {
      meta: 'Conexión',
      error: 'El Curador del caso no puede alcanzar el expediente ahora.',
      errorPrefix: 'El Curador del caso no puede alcanzar el expediente ahora:',
    },
    closed: {
      completed: 'El expediente de archivo está completo. Únete a la lista para continuar después de la demo.',
      message_limit: 'La vista previa se cerró tras diez entradas. Únete a la lista para el archivo completo.',
      guard: 'El guardia ha terminado este intento. La transcripción queda preservada.',
    },
    dice: {
      title: 'Prueba d100',
      threshold: 'Necesitas',
      contextFallback: 'El Curador del caso espera el resultado.',
      tens: 'decenas',
      units: 'unidades',
      result: 'resultado',
      roll: 'Tirar d100',
      rolling: 'Los dados ruedan...',
      success: 'éxito',
      fail: 'fallo',
      send: (result: number) => `Enviar ${result}`,
    },
    modal: {
      previewComplete: 'Vista completada',
      returnToFile: 'Volver al expediente',
      reviewFile: 'Revisar expediente',
      alreadyCleared: '¿Ya tienes acceso?',
      completed: {
        stamp: 'Dentro',
        title: 'El archivo se abre.',
        body: 'Barri abre el acceso por grupos controlados. Deja tu email y el Buró te llamará cuando la próxima mesa esté lista.',
      },
      message_limit: {
        stamp: 'Archivado',
        title: 'El Curador del caso cierra la vista previa.',
        body: 'Diez entradas bastan para demostrar que el expediente vive. Únete a la lista y el Buró te convocará al caso completo.',
      },
      guard: {
        stamp: 'Capturado',
        title: 'El guardia te encuentra.',
        body: 'La ronda llega al corredor antes de que el Archivo 7 se abra. Deja tu email e intenta el caso completo cuando tengas acceso.',
      },
      manual: {
        stamp: 'Lista',
        title: 'Unirse a la lista.',
        body: 'Barri abre el acceso por grupos controlados. Deja tu email y el Buró te llamará cuando la próxima mesa esté lista.',
      },
    },
    waitlist: {
      emailLabel: 'Email del investigador',
      placeholder: 'investigator@example.com',
      loading: 'Archivando...',
      submit: 'Unirse',
      privacy: {
        before: 'Usamos tu email para gestionar esta solicitud de lista de espera. Consulta la',
        privacy: 'Política de privacidad',
        between: ' y los ',
        terms: 'Términos',
        after: '.',
      },
      successTitle: 'Archivado en la lista de espera.',
      successBody: 'Tenemos tu dirección. La próxima carta no estará en blanco.',
    },
  },
} as const;

type DemoCopy = (typeof DEMO_COPY)[keyof typeof DEMO_COPY];
