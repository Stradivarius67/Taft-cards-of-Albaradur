import { describe, it, expect } from 'vitest';
import {
  MUTATORS,
  WEEKLY_ROTATION,
  isValidMutator,
  normalizeMutator,
  getWeeklyMutator,
  getStartingHandSize,
  hornEnabled,
  unitStrengthBonus,
} from '../src/game/mutators.js';
import { GameEngine } from '../src/game/engine.js';
import { RoomManager } from '../src/rooms/manager.js';
import { Card, GameState } from '../src/types.js';

function unit(id: string, strength: number, name = id, ability: Card['ability'] = 'none'): Card {
  return { id, name, faction: 'lion_guard', type: 'unit', row: 'melee', strength, ability };
}

describe('Mutators — registry & helpers', () => {
  it('every rotation entry exists in the registry', () => {
    for (const id of WEEKLY_ROTATION) {
      expect(MUTATORS[id]).toBeDefined();
      expect(MUTATORS[id].id).toBe(id);
    }
  });

  it('isValidMutator accepts known ids and rejects junk', () => {
    expect(isValidMutator('reinforcements')).toBe(true);
    expect(isValidMutator('none')).toBe(true);
    expect(isValidMutator('nonsense')).toBe(false);
    expect(isValidMutator(42)).toBe(false);
    expect(isValidMutator(undefined)).toBe(false);
  });

  it('normalizeMutator falls back to none for invalid input', () => {
    expect(normalizeMutator('still_air')).toBe('still_air');
    expect(normalizeMutator('hacker')).toBe('none');
    expect(normalizeMutator(undefined)).toBe('none');
  });

  it('getWeeklyMutator is deterministic for a given date', () => {
    const d = new Date('2026-06-07T00:00:00Z');
    expect(getWeeklyMutator(d)).toBe(getWeeklyMutator(d));
    expect(WEEKLY_ROTATION).toContain(getWeeklyMutator(d));
  });

  it('getWeeklyMutator rotates across consecutive weeks', () => {
    const results = new Set<string>();
    const base = new Date('2026-01-01T00:00:00Z').getTime();
    const week = 7 * 24 * 60 * 60 * 1000;
    for (let i = 0; i < WEEKLY_ROTATION.length; i++) {
      results.add(getWeeklyMutator(new Date(base + i * week)));
    }
    // За N недель должны увидеть все N мутаторов ротации
    expect(results.size).toBe(WEEKLY_ROTATION.length);
  });

  it('helper flags map correctly', () => {
    expect(getStartingHandSize('grand_arsenal')).toBe(11);
    expect(getStartingHandSize('none')).toBe(10);
    expect(hornEnabled('still_air')).toBe(false);
    expect(hornEnabled('reinforcements')).toBe(true);
    expect(unitStrengthBonus('reinforcements')).toBe(1);
    expect(unitStrengthBonus('none')).toBe(0);
  });
});

describe('Mutators — engine strength effects', () => {
  const engine = new GameEngine();
  const cards = [unit('a', 4), unit('b', 6)]; // base sum = 10

  it('reinforcements adds +1 per unit', () => {
    expect(engine.calculateRowStrength(cards, false, false, 'none')).toBe(10);
    expect(engine.calculateRowStrength(cards, false, false, 'reinforcements')).toBe(12);
  });

  it('reinforcements applies after weather (frosted unit = 2, not 1)', () => {
    // Без мутатора мороз делает обе карты = 1 → сумма 2
    expect(engine.calculateRowStrength(cards, true, false, 'none')).toBe(2);
    // С подкреплениями: 1+1 каждая → сумма 4
    expect(engine.calculateRowStrength(cards, true, false, 'reinforcements')).toBe(4);
  });

  it('still_air disables horn doubling', () => {
    expect(engine.calculateRowStrength(cards, false, true, 'none')).toBe(20);
    expect(engine.calculateRowStrength(cards, false, true, 'still_air')).toBe(10);
  });

  it('mutator defaults to none when omitted (back-compat)', () => {
    expect(engine.calculateRowStrength(cards, false, false)).toBe(10);
  });
});

describe('Mutators — wiring through room & game start', () => {
  it('RoomManager stores the mutator on room and gameState', () => {
    const manager = new RoomManager();
    try {
      const room = manager.createRoom('s1', false, 'grand_arsenal');
      expect(room.mutator).toBe('grand_arsenal');
      expect(room.gameState.mutator).toBe('grand_arsenal');
    } finally {
      manager.destroy();
    }
  });

  it('grand_arsenal deals 11 cards at start instead of 10', () => {
    const engine = new GameEngine();
    const base: GameState = {
      id: 'T1',
      phase: 'faction_select',
      players: [
        { id: 'p0', faction: 'lion_guard', hand: [], deck: [], discard: [], passed: false, roundsWon: 0, field: { melee: [], ranged: [], siege: [] }, hornActive: { melee: false, ranged: false, siege: false }, leaderUsed: false },
        { id: 'p1', faction: 'imperial_dogs', hand: [], deck: [], discard: [], passed: false, roundsWon: 0, field: { melee: [], ranged: [], siege: [] }, hornActive: { melee: false, ranged: false, siege: false }, leaderUsed: false },
      ],
      currentPlayerIndex: 0,
      round: 1,
      weather: { frost: false, fog: false, rain: false },
      mutator: 'grand_arsenal',
      log: [],
      redrawsDone: [],
    };
    const started = engine.startGame(base);
    expect(started.players[0].hand.length).toBe(11);
    expect(started.players[1].hand.length).toBe(11);

    const normal = engine.startGame({ ...base, mutator: 'none' });
    expect(normal.players[0].hand.length).toBe(10);
  });
});
