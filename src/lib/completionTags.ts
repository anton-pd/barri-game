export type CompletionAction = 'finish-evening' | 'complete-session';

/**
 * Detect a session-completion intent emitted by the Keeper in its response.
 *
 *   [FINISH_EVENING]   — campaign: end the current evening, start the next
 *   [COMPLETE_SESSION] — end the session/campaign for good
 *
 * `finish-evening` takes precedence if both tags somehow appear. Returns null
 * when neither tag is present. Single-sourced here so the route and tests share
 * the exact same regex contract.
 */
export function detectCompletionAction(text: string): CompletionAction | null {
  if (/\[FINISH_EVENING\]/.test(text)) return 'finish-evening';
  if (/\[COMPLETE_SESSION\]/.test(text)) return 'complete-session';
  return null;
}
