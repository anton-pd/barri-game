import { describe, it, expect } from 'vitest';
import { detectCompletionAction } from '@/lib/completionTags';

describe('detectCompletionAction', () => {
  it('detects [FINISH_EVENING]', () => {
    expect(detectCompletionAction('Вечір добігає кінця. [FINISH_EVENING]')).toBe('finish-evening');
  });

  it('detects [COMPLETE_SESSION]', () => {
    expect(detectCompletionAction('Справу розкрито. [COMPLETE_SESSION]')).toBe('complete-session');
  });

  it('prefers finish-evening when both tags appear', () => {
    expect(detectCompletionAction('[COMPLETE_SESSION] ... [FINISH_EVENING]')).toBe('finish-evening');
  });

  it('returns null when no completion tag is present', () => {
    expect(detectCompletionAction('Звичайна відповідь без тегів завершення.')).toBeNull();
  });

  it('ignores lookalike text that is not the exact tag', () => {
    expect(detectCompletionAction('гравці завершують вечерю')).toBeNull();
  });
});
