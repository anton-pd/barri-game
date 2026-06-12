import { describe, expect, it } from 'vitest';
import { applyEventDoneTags } from '@/lib/eventTags';
import { makeWorldState } from './fixtures';

describe('applyEventDoneTags', () => {
  it('marks a valid event index and strips the tag from narration', () => {
    const state = makeWorldState();
    const result = applyEventDoneTags(
      'Кнотт нарешті зізнається про справу. [EVENT_DONE:1]',
      state,
      5
    );

    expect(result.cleanText.trim()).toBe('Кнотт нарешті зізнається про справу.');
    expect(result.worldState.completedMustEvents).toEqual([1]);
  });

  it('accumulates indices across calls and keeps them sorted', () => {
    const state = makeWorldState({ completedMustEvents: [3] });
    const result = applyEventDoneTags('[EVENT_DONE:1] [EVENT_DONE:5]', state, 5);

    expect(result.worldState.completedMustEvents).toEqual([1, 3, 5]);
  });

  it('ignores out-of-range and non-numeric payloads but still strips the tags', () => {
    const state = makeWorldState();
    const result = applyEventDoneTags(
      'Текст. [EVENT_DONE:0] [EVENT_DONE:6] [EVENT_DONE:abc] [EVENT_DONE:1.5] [EVENT_DONE:]',
      state,
      5
    );

    expect(result.cleanText.trim()).toBe('Текст.');
    expect(result.worldState.completedMustEvents).toBeUndefined();
    expect(result.worldState).toBe(state);
  });

  it('deduplicates an already-completed index without touching state identity', () => {
    const state = makeWorldState({ completedMustEvents: [2] });
    const result = applyEventDoneTags('[EVENT_DONE:2]', state, 5);

    expect(result.worldState).toBe(state);
    expect(result.worldState.completedMustEvents).toEqual([2]);
  });

  it('ignores everything when the scenario has no must-happen events', () => {
    const state = makeWorldState();
    const result = applyEventDoneTags('[EVENT_DONE:1]', state, 0);

    expect(result.cleanText).toBe('');
    expect(result.worldState).toBe(state);
  });
});
