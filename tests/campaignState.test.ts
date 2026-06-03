import { describe, it, expect } from 'vitest';
import { buildNextSessionWorldState } from '@/lib/campaignState';
import { makeWorldState } from './fixtures';

describe('buildNextSessionWorldState', () => {
  it('carries persistent campaign knowledge forward (ANT-79)', () => {
    const prev = makeWorldState({
      act: 2,
      npcRelations: { kovalska: 'friendly' },
      visitedLocations: ['study', 'library'],
      discoveredClues: ['лист', 'щоденник'],
      dynamicLocations: { attic: { name: 'Горище', description: 'Темно і пилюка' } },
      dynamicNpcs: [{ id: 'dynamic_ston', name: 'Стоунер' }],
      openThreads: ['хто вбив бібліотекаря'],
    });
    const next = buildNextSessionWorldState(prev, 'Вечір 1 завершено.');

    expect(next.act).toBe(2);
    expect(next.npcRelations).toEqual({ kovalska: 'friendly' });
    expect(next.visitedLocations).toEqual(['study', 'library']);
    expect(next.discoveredClues).toEqual(['лист', 'щоденник']);
    expect(next.dynamicLocations).toEqual({ attic: { name: 'Горище', description: 'Темно і пилюка' } });
    expect(next.dynamicNpcs).toEqual([{ id: 'dynamic_ston', name: 'Стоунер' }]);
    expect(next.openThreads).toEqual(['хто вбив бібліотекаря']);
    expect(next.summary).toBe('Вечір 1 завершено.');
  });

  it('resets per-evening transient state', () => {
    const prev = makeWorldState({
      passiveMessageCount: 12,
      totalMessageCount: 40,
      pendingRollResult: { characterIdx: 0, skillName: 'Спостережливість', skillValue: 50, context: '', goodThreshold: 50 },
      activeRandomEvent: { id: 'e', type: 'neutral', description: 'x', groupId: 'g' },
      locationRisk: { g: { currentChance: 40, incrementRate: 2, eventCycleCount: 3, lastEventAt: 5 } },
      sessionImages: { msg1: '/scenarios/dynamic/abc.jpg' },
      variantHint: 'почни з вокзалу',
    });
    const next = buildNextSessionWorldState(prev, 'короткий підсумок');

    expect(next.passiveMessageCount).toBe(0);
    expect(next.totalMessageCount).toBe(0);
    expect(next.pendingRollResult).toBeUndefined();
    expect(next.activeRandomEvent).toBeUndefined();
    expect(next.locationRisk).toEqual({});
    expect(next.sessionImages).toEqual({});
    expect(next.variantHint).toBeUndefined();
  });

  it('does not mutate the input world state (pure)', () => {
    const prev = makeWorldState({ totalMessageCount: 10, npcRelations: { a: 'hostile' } });
    buildNextSessionWorldState(prev, 's');
    expect(prev.totalMessageCount).toBe(10);
    expect(prev.npcRelations).toEqual({ a: 'hostile' });
  });
});
