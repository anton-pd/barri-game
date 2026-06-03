import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  evaluateRandomEvent,
  applyEventDecision,
  resolveActiveEvent,
  clearActiveEvent,
  buildEventInstruction,
} from '@/lib/randomEvents';
import { makeScenario, makeWorldState } from './fixtures';
import type { RandomEventDecision } from '@/lib/randomEvents';

afterEach(() => vi.restoreAllMocks());

describe('evaluateRandomEvent — guard branches', () => {
  it('never fires while a roll is pending', () => {
    const d = evaluateRandomEvent(makeWorldState(), makeScenario(), undefined, true);
    expect(d.shouldFire).toBe(false);
    expect(d.eventType).toBeNull();
  });

  it('never fires while another event is already active', () => {
    const ws = makeWorldState({
      activeRandomEvent: { id: 'e1', type: 'neutral', description: '', groupId: 'g' },
    });
    const d = evaluateRandomEvent(ws, makeScenario(), undefined, false);
    expect(d.shouldFire).toBe(false);
  });
});

describe('evaluateRandomEvent — accumulation', () => {
  it('fires when the roll falls under the accumulated chance, then resets + halves increment', () => {
    // First call seeds risk for the group; Math.random low → fires.
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const ws = makeWorldState({
      currentLocationGroup: 'default',
      locationRisk: { default: { currentChance: 50, incrementRate: 5.5, eventCycleCount: 0, lastEventAt: 0 } },
    });
    const d = evaluateRandomEvent(ws, makeScenario(), undefined, false);
    expect(d.shouldFire).toBe(true);
    expect(d.updatedRisk.currentChance).toBe(5); // BASE_CHANCE reset
    expect(d.updatedRisk.incrementRate).toBeCloseTo(2.75); // halved
    expect(d.updatedRisk.eventCycleCount).toBe(1);
  });

  it('does not fire when the roll is above the accumulated chance; stores grown chance', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const ws = makeWorldState({
      currentLocationGroup: 'default',
      locationRisk: { default: { currentChance: 10, incrementRate: 5.5, eventCycleCount: 0, lastEventAt: 0 } },
    });
    const d = evaluateRandomEvent(ws, makeScenario(), undefined, false);
    expect(d.shouldFire).toBe(false);
    expect(d.updatedRisk.currentChance).toBeCloseTo(15.5); // 10 + 5.5
  });
});

describe('applyEventDecision', () => {
  it('stores updated risk and sets activeRandomEvent when firing', () => {
    const decision: RandomEventDecision = {
      shouldFire: true,
      isTransitionEvent: false,
      eventType: 'negative',
      currentChance: 40,
      updatedRisk: { currentChance: 5, incrementRate: 2.75, eventCycleCount: 1, lastEventAt: 3 },
    };
    const ws = applyEventDecision(makeWorldState({ currentLocationGroup: 'default' }), decision, undefined, makeScenario());
    expect(ws.locationRisk?.default).toMatchObject({ currentChance: 5, eventCycleCount: 1 });
    expect(ws.activeRandomEvent).toMatchObject({ type: 'negative', groupId: 'default' });
  });

  it('does not set activeRandomEvent when not firing', () => {
    const decision: RandomEventDecision = {
      shouldFire: false,
      isTransitionEvent: false,
      eventType: null,
      currentChance: 15,
      updatedRisk: { currentChance: 15, incrementRate: 5.5, eventCycleCount: 0, lastEventAt: 0 },
    };
    const ws = applyEventDecision(makeWorldState({ currentLocationGroup: 'default' }), decision, undefined, makeScenario());
    expect(ws.activeRandomEvent).toBeUndefined();
  });
});

describe('resolveActiveEvent / clearActiveEvent', () => {
  it('writes the description onto the active event', () => {
    const ws = makeWorldState({ activeRandomEvent: { id: 'e1', type: 'roll_event', description: '', groupId: 'g' } });
    expect(resolveActiveEvent(ws, 'падіння балки').activeRandomEvent?.description).toBe('падіння балки');
  });

  it('is a no-op when there is no active event', () => {
    const ws = makeWorldState();
    expect(resolveActiveEvent(ws, 'щось')).toBe(ws);
  });

  it('removes the activeRandomEvent key entirely', () => {
    const ws = makeWorldState({ activeRandomEvent: { id: 'e1', type: 'neutral', description: 'x', groupId: 'g' } });
    expect(clearActiveEvent(ws).activeRandomEvent).toBeUndefined();
  });
});

describe('buildEventInstruction', () => {
  it('includes the resolve-by-roll guidance and the [RANDOM_EVENT] tag for roll_event', () => {
    const out = buildEventInstruction('roll_event', false, makeScenario());
    expect(out).toContain('[RANDOM_EVENT:roll_event:');
    expect(out).toContain('SET_PENDING_ROLL');
  });

  it('adds a transition note when isTransition is true', () => {
    const out = buildEventInstruction('neutral', true, makeScenario());
    expect(out).toContain('переходом між локаціями');
  });
});
