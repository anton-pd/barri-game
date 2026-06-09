import { describe, expect, it } from 'vitest';
import { applyCasePlanTags } from '@/lib/casePlanTags';
import { makeWorldState } from './fixtures';

describe('applyCasePlanTags', () => {
  it('adds a newly available plan item and strips the tag from narration', () => {
    const state = makeWorldState();
    const result = applyCasePlanTags(
      'У шафі лежить адреса. [CASE_PLAN:{"id":"check_archives","label":"Перевірити міські архіви","status":"available"}]',
      state
    );

    expect(result.cleanText.trim()).toBe('У шафі лежить адреса.');
    expect(result.worldState.casePlan?.items).toEqual([
      {
        id: 'check_archives',
        label: 'Перевірити міські архіви',
        status: 'available',
      },
    ]);
  });

  it('updates an existing item status without moving it', () => {
    const state = makeWorldState({
      casePlan: {
        items: [
          { id: 'check_archives', label: 'Перевірити міські архіви', status: 'available' },
          { id: 'question_caretaker', label: 'Допитати доглядача', status: 'available' },
        ],
      },
    });

    const result = applyCasePlanTags(
      '[CASE_PLAN:{"id":"check_archives","status":"completed","note":"Запис знайдено."}]',
      state
    );

    expect(result.worldState.casePlan?.items).toEqual([
      {
        id: 'check_archives',
        label: 'Перевірити міські архіви',
        status: 'completed',
        note: 'Запис знайдено.',
      },
      { id: 'question_caretaker', label: 'Допитати доглядача', status: 'available' },
    ]);
  });

  it('supports crossed-out and hidden statuses', () => {
    const state = makeWorldState();
    const result = applyCasePlanTags(
      [
        '[CASE_PLAN:{"id":"force_door","label":"Вибити двері","status":"crossed_out","note":"Сторож почув шум."}]',
        '[CASE_PLAN:{"id":"secret_room","label":"Знайти таємну кімнату","status":"hidden"}]',
      ].join(' '),
      state
    );

    expect(result.worldState.casePlan?.items).toEqual([
      {
        id: 'force_door',
        label: 'Вибити двері',
        status: 'crossed_out',
        note: 'Сторож почув шум.',
      },
      {
        id: 'secret_room',
        label: 'Знайти таємну кімнату',
        status: 'hidden',
      },
    ]);
  });

  it('ignores malformed or incomplete tags but still strips them', () => {
    const state = makeWorldState();
    const result = applyCasePlanTags(
      'Текст [CASE_PLAN:not-json] [CASE_PLAN:{"id":"no_label"}]',
      state
    );

    expect(result.cleanText).toBe('Текст  ');
    expect(result.worldState.casePlan).toBeUndefined();
  });
});
