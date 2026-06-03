import { describe, it, expect } from 'vitest';
import { mergeSummarizedWorldState } from '@/lib/worldStateMerge';
import { makeWorldState } from './fixtures';
import type { WorldState } from '@/types';

describe('mergeSummarizedWorldState (ANT-68)', () => {
  it('keeps the authoritative currentLocation, ignoring the summary guess', () => {
    const current = makeWorldState({
      currentLocation: 'my_apartments',
      dynamicLocations: { my_apartments: { name: 'Моя квартира', description: 'Тісна квартира.' } },
    });
    // Summary LLM doesn't know the dynamic location and guesses an old one.
    const parsed: Partial<WorldState> = { currentLocation: 'study', summary: 'Гравці повернулись.' };

    const merged = mergeSummarizedWorldState(current, parsed);

    expect(merged.currentLocation).toBe('my_apartments');
    expect(merged.dynamicLocations).toEqual(current.dynamicLocations);
  });

  it('does not let the summary drop or rewrite visitedLocations', () => {
    const current = makeWorldState({ visitedLocations: ['study', 'my_apartments', 'library'] });
    const parsed: Partial<WorldState> = { visitedLocations: ['study'] };

    expect(mergeSummarizedWorldState(current, parsed).visitedLocations).toEqual([
      'study',
      'my_apartments',
      'library',
    ]);
  });

  it('preserves currentLocationGroup, dynamicLocations, and dynamicNpcs', () => {
    const current = makeWorldState({
      currentLocationGroup: 'house',
      dynamicLocations: { alley: { name: 'Алея', description: 'Темна алея.' } },
      dynamicNpcs: [{ id: 'stranger', name: 'Незнайомець' }],
    });
    const parsed: Partial<WorldState> = {};

    const merged = mergeSummarizedWorldState(current, parsed);
    expect(merged.currentLocationGroup).toBe('house');
    expect(merged.dynamicLocations).toEqual(current.dynamicLocations);
    expect(merged.dynamicNpcs).toEqual(current.dynamicNpcs);
  });

  it('applies narrative summary fields (act, summary, clues, npcRelations, threads, notes)', () => {
    const current = makeWorldState({ act: 1, summary: '', discoveredClues: [] });
    const parsed: Partial<WorldState> = {
      act: 2,
      summary: 'Знайдено лист.',
      discoveredClues: ['letter'],
      npcRelations: { kovalska: 'friendly' },
      openThreads: ['Хто вбивця?'],
      playerNotes: ['Обшукали стіл'],
    };

    const merged = mergeSummarizedWorldState(current, parsed);
    expect(merged.act).toBe(2);
    expect(merged.summary).toBe('Знайдено лист.');
    expect(merged.discoveredClues).toEqual(['letter']);
    expect(merged.npcRelations).toEqual({ kovalska: 'friendly' });
    expect(merged.openThreads).toEqual(['Хто вбивця?']);
    expect(merged.playerNotes).toEqual(['Обшукали стіл']);
  });

  it('never clobbers the sessionImages cache even if the summary includes it', () => {
    const current = makeWorldState({ sessionImages: { 'msg-1': '/scenarios/dynamic/abc.jpg' } });
    const parsed = { sessionImages: {} } as Partial<WorldState>;

    expect(mergeSummarizedWorldState(current, parsed).sessionImages).toEqual({
      'msg-1': '/scenarios/dynamic/abc.jpg',
    });
  });

  it('preserves engine fields (pendingRollResult, activeRandomEvent, locationRisk)', () => {
    const current = makeWorldState({
      pendingRollResult: { characterIdx: 0, skillName: 'Spot', skillValue: 50, context: 'c', goodThreshold: 25 },
      locationRisk: { house: { currentChance: 0.2, incrementRate: 0.05, eventCycleCount: 1, lastEventAt: 3 } },
    });
    const parsed: Partial<WorldState> = { summary: 'x' };

    const merged = mergeSummarizedWorldState(current, parsed);
    expect(merged.pendingRollResult).toEqual(current.pendingRollResult);
    expect(merged.locationRisk).toEqual(current.locationRisk);
  });
});
