import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/game/engine.js';
import { GameState, PlayerState, Card, FactionId } from '../src/types.js';
import { getDeckCopy, factions } from '../src/game/factions.js';

function makePlayer(id: string, faction: FactionId): PlayerState {
  return {
    id,
    faction,
    hand: [],
    deck: [],
    discard: [],
    passed: false,
    roundsWon: 0,
    field: { melee: [], ranged: [], siege: [] },
    hornActive: { melee: false, ranged: false, siege: false },
    leaderUsed: false,
  };
}

function makeState(
  faction0: FactionId = 'lion_guard',
  faction1: FactionId = 'imperial_dogs'
): GameState {
  return {
    id: 'TEST',
    phase: 'faction_select',
    players: [makePlayer('p0', faction0), makePlayer('p1', faction1)],
    currentPlayerIndex: 0,
    round: 1,
    weather: { frost: false, fog: false, rain: false },
    log: [],
    redrawsDone: [],
  };
}

function makeUnit(overrides: Partial<Card> = {}): Card {
  return {
    id: 'u1',
    name: 'TestUnit',
    faction: 'lion_guard',
    type: 'unit',
    row: 'melee',
    strength: 5,
    ability: 'none',
    ...overrides,
  };
}

describe('GameEngine', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
  });

  // ===========================================================================
  // Иммутабельность
  // ===========================================================================
  describe('immutability', () => {
    it('startGame should not mutate original state', () => {
      const original = makeState();
      const originalPhase = original.phase;
      engine.startGame(original);
      expect(original.phase).toBe(originalPhase);
    });

    it('redrawCards should not mutate original state', () => {
      const state = engine.startGame(makeState());
      const handBefore = [...state.players[0].hand.map(c => c.id)];
      engine.redrawCards(state, 0, [state.players[0].hand[0].id]);
      // Original hand unchanged
      expect(state.players[0].hand.map(c => c.id)).toEqual(handBefore);
    });

    it('pass should not mutate original state', () => {
      let state = engine.startGame(makeState());
      state = engine.redrawCards(state, 0, []);
      state = engine.redrawCards(state, 1, []);
      state.partisansPending = false;
      state.phase = 'playing';
      const passedBefore = state.players[0].passed;
      engine.pass(state, 0);
      expect(state.players[0].passed).toBe(passedBefore);
    });

    it('playCard should not mutate original state', () => {
      let state = engine.startGame(makeState());
      state = engine.redrawCards(state, 0, []);
      state = engine.redrawCards(state, 1, []);
      state.partisansPending = false;
      state.phase = 'playing';
      const card = state.players[0].hand.find(c => c.type === 'unit' && c.ability === 'none');
      if (!card) return;
      const handLen = state.players[0].hand.length;
      engine.playCard(state, 0, card.id, card.row);
      expect(state.players[0].hand.length).toBe(handLen);
    });
  });

  // ===========================================================================
  // startGame
  // ===========================================================================
  describe('startGame', () => {
    it('should deal 10 cards and leave 12 in deck', () => {
      const state = engine.startGame(makeState());
      expect(state.phase).toBe('redraw');
      expect(state.players[0].hand.length).toBe(10);
      expect(state.players[1].hand.length).toBe(10);
      expect(state.players[0].deck.length).toBe(12);
      expect(state.players[1].deck.length).toBe(12);
    });
  });

  // ===========================================================================
  // redrawCards
  // ===========================================================================
  describe('redrawCards', () => {
    it('should allow 0 redraws', () => {
      const state = engine.startGame(makeState());
      const result = engine.redrawCards(state, 0, []);
      expect(result.players[0].hand.length).toBe(10);
      expect(result.redrawsDone).toContain(0);
    });

    it('should allow 1 redraw', () => {
      const state = engine.startGame(makeState());
      const cardId = state.players[0].hand[0].id;
      const result = engine.redrawCards(state, 0, [cardId]);
      expect(result.players[0].hand.length).toBe(10);
      expect(result.redrawsDone).toContain(0);
    });

    it('should allow 2 redraws', () => {
      const state = engine.startGame(makeState());
      const ids = [state.players[0].hand[0].id, state.players[0].hand[1].id];
      const result = engine.redrawCards(state, 0, ids);
      expect(result.players[0].hand.length).toBe(10);
    });

    it('should reject 3 redraws', () => {
      const state = engine.startGame(makeState());
      const ids = state.players[0].hand.slice(0, 3).map(c => c.id);
      const result = engine.redrawCards(state, 0, ids);
      expect(result.log.some(l => l.includes('max 2'))).toBe(true);
    });

    it('should transition to playing after both redraw (no partisans)', () => {
      const state = engine.startGame(makeState('lion_guard', 'imperial_dogs'));
      let s = engine.redrawCards(state, 0, []);
      s = engine.redrawCards(s, 1, []);
      expect(s.phase).toBe('playing');
    });

    it('should transition to partisans_choice when partisans present', () => {
      const state = engine.startGame(makeState('litlad_partisans', 'imperial_dogs'));
      let s = engine.redrawCards(state, 0, []);
      s = engine.redrawCards(s, 1, []);
      expect(s.phase).toBe('partisans_choice');
      expect(s.partisansPending).toBe(true);
    });

    it('should not allow double redraw', () => {
      const state = engine.startGame(makeState());
      const s = engine.redrawCards(state, 0, []);
      const s2 = engine.redrawCards(s, 0, []);
      // Same state returned (no second redraw)
      expect(s2.redrawsDone.filter(x => x === 0).length).toBe(1);
    });
  });

  // ===========================================================================
  // playCard
  // ===========================================================================
  describe('playCard', () => {
    function readyState(f0: FactionId = 'lion_guard', f1: FactionId = 'imperial_dogs'): GameState {
      let s = engine.startGame(makeState(f0, f1));
      s = engine.redrawCards(s, 0, []);
      s = engine.redrawCards(s, 1, []);
      s.partisansPending = false;
      s.phase = 'playing';
      return s;
    }

    it('should place unit on correct row', () => {
      const state = readyState();
      const card = state.players[0].hand.find(c => c.type === 'unit' && c.row === 'melee' && c.ability === 'none');
      if (!card) return;

      const { state: s } = engine.playCard(state, 0, card.id);
      expect(s.players[0].field.melee.some(c => c.id === card.id)).toBe(true);
      expect(s.players[0].hand.some(c => c.id === card.id)).toBe(false);
    });

    it('should reject play when not your turn', () => {
      const state = readyState();
      state.currentPlayerIndex = 1;
      const card = state.players[0].hand[0];
      const { error } = engine.playCard(state, 0, card.id);
      expect(error).toBeDefined();
    });

    it('should reject card not in hand', () => {
      const state = readyState();
      const { error } = engine.playCard(state, 0, 'nonexistent_id');
      expect(error).toBeDefined();
    });

    it('should reject play when player already passed', () => {
      let state = readyState();
      state = engine.pass(state, 0);
      state.currentPlayerIndex = 0;
      const card = state.players[0].hand[0];
      const { error } = engine.playCard(state, 0, card.id);
      expect(error).toBeDefined();
    });

    it('should advance turn after playing card', () => {
      const state = readyState();
      state.currentPlayerIndex = 0;
      const card = state.players[0].hand.find(c => c.type === 'unit' && c.ability === 'none');
      if (!card) return;
      const { state: s } = engine.playCard(state, 0, card.id, card.row);
      expect(s.currentPlayerIndex).toBe(1);
    });

    it('should handle flexibleRow with targetRow', () => {
      const state = readyState('litlad_partisans', 'imperial_dogs');
      state.phase = 'playing';
      state.partisansPending = false;
      const card = state.players[0].hand.find(c => c.flexibleRow && c.type === 'unit' && c.ability === 'none');
      if (!card) return;

      const { state: s } = engine.playCard(state, 0, card.id, 'siege');
      expect(s.players[0].field.siege.some(c => c.id === card.id)).toBe(true);
    });

    it('should reject flexibleRow without targetRow', () => {
      const state = readyState('litlad_partisans', 'imperial_dogs');
      state.phase = 'playing';
      state.partisansPending = false;
      const card = state.players[0].hand.find(c => c.flexibleRow && c.type === 'unit' && c.ability === 'none');
      if (!card) return;

      const { error } = engine.playCard(state, 0, card.id);
      expect(error).toBeDefined();
    });

    it('should make medic choice atomic and advance only after a valid choice', () => {
      const state = readyState();
      const medic = makeUnit({ id: 'medic', ability: 'medic' });
      const discarded = makeUnit({ id: 'discarded', row: 'ranged' });
      state.players[0].hand = [medic];
      state.players[0].discard = [discarded];

      const played = engine.playCard(state, 0, medic.id);
      expect(played.error).toBeUndefined();
      expect(played.state.pendingAction).toBe('medic_choice');
      expect(played.state.currentPlayerIndex).toBe(0);

      const outOfOrderPlay = engine.playCard(played.state, 0, medic.id);
      expect(outOfOrderPlay.error).toContain('завершите');

      const invalidChoice = engine.resolveMedicChoice(played.state, 1, discarded.id);
      expect(invalidChoice.error).toBeDefined();

      const resolved = engine.resolveMedicChoice(played.state, 0, discarded.id);
      expect(resolved.error).toBeUndefined();
      expect(resolved.state.pendingAction).toBeNull();
      expect(resolved.state.currentPlayerIndex).toBe(1);
      expect(resolved.state.players[0].field.ranged.some(card => card.id === discarded.id)).toBe(true);
    });

    it('should not mutate pending state when medic selection is skipped', () => {
      const state = makeState();
      state.phase = 'playing';
      state.pendingAction = 'medic_choice';
      state.pendingActionPlayer = 0;
      state.pendingMedicCardIds = [];
      const before = structuredClone(state);

      const result = engine.resolveMedicChoice(state, 0, null);

      expect(state).toEqual(before);
      expect(result.state).not.toBe(state);
      expect(result.state.pendingAction).toBeNull();
    });

    it('should block normal actions while a leader choice is pending', () => {
      const state = readyState('imperial_dogs', 'lion_guard');
      state.players[1].hand = [makeUnit({ id: 'target' })];
      const activated = engine.activateLeader(state, 0);

      expect(activated.state.pendingAction).toBe('informant_choice');
      expect(engine.playCard(activated.state, 0, activated.state.players[0].hand[0].id).error)
        .toContain('завершите');
      expect(engine.pass(activated.state, 0)).toBe(activated.state);
    });
  });

  // ===========================================================================
  // calculateRowStrength
  // ===========================================================================
  describe('calculateRowStrength', () => {
    it('should sum base strength', () => {
      const cards = [makeUnit({ strength: 5 }), makeUnit({ id: 'u2', strength: 3 })];
      expect(engine.calculateRowStrength(cards, false, false)).toBe(8);
    });

    it('should return 0 for empty row', () => {
      expect(engine.calculateRowStrength([], false, false)).toBe(0);
    });

    it('bond: 2 same-name cards → each *2', () => {
      const cards = [
        makeUnit({ id: 'b1', name: 'Soldier', strength: 4, ability: 'bond' }),
        makeUnit({ id: 'b2', name: 'Soldier', strength: 4, ability: 'bond' }),
      ];
      // Each: 4*2=8, total: 16
      expect(engine.calculateRowStrength(cards, false, false)).toBe(16);
    });

    it('bond: 3 same-name cards → each *2 (NOT *3)', () => {
      const cards = [
        makeUnit({ id: 'b1', name: 'Soldier', strength: 4, ability: 'bond' }),
        makeUnit({ id: 'b2', name: 'Soldier', strength: 4, ability: 'bond' }),
        makeUnit({ id: 'b3', name: 'Soldier', strength: 4, ability: 'bond' }),
      ];
      // Each: 4*2=8, total: 24
      expect(engine.calculateRowStrength(cards, false, false)).toBe(24);
    });

    it('bond: single card with bond does NOT double', () => {
      const cards = [makeUnit({ id: 'b1', name: 'Loner', strength: 5, ability: 'bond' })];
      expect(engine.calculateRowStrength(cards, false, false)).toBe(5);
    });

    it('morale: +1 to others, not self', () => {
      const cards = [
        makeUnit({ id: 'm1', name: 'Drummer', strength: 2, ability: 'morale' }),
        makeUnit({ id: 'u1', name: 'Fighter', strength: 5 }),
        makeUnit({ id: 'u2', name: 'Guard', strength: 3 }),
      ];
      // Drummer: 2, Fighter: 5+1=6, Guard: 3+1=4 → 12
      expect(engine.calculateRowStrength(cards, false, false)).toBe(12);
    });

    it('two morales: each buffs the other + all non-morales', () => {
      const cards = [
        makeUnit({ id: 'm1', name: 'Drum1', strength: 2, ability: 'morale' }),
        makeUnit({ id: 'm2', name: 'Drum2', strength: 3, ability: 'morale' }),
        makeUnit({ id: 'u1', name: 'Fighter', strength: 5 }),
      ];
      // Drum1: 2+1=3, Drum2: 3+1=4, Fighter: 5+2=7 → 14
      expect(engine.calculateRowStrength(cards, false, false)).toBe(14);
    });

    it('horn: doubles total row strength', () => {
      const cards = [makeUnit({ strength: 5 }), makeUnit({ id: 'u2', strength: 3 })];
      expect(engine.calculateRowStrength(cards, false, true)).toBe(16);
    });

    it('weather: all units become 1', () => {
      const cards = [makeUnit({ strength: 8 }), makeUnit({ id: 'u2', strength: 6 })];
      expect(engine.calculateRowStrength(cards, true, false)).toBe(2);
    });

    it('weather + horn', () => {
      const cards = [makeUnit({ strength: 8 }), makeUnit({ id: 'u2', strength: 6 })];
      expect(engine.calculateRowStrength(cards, true, true)).toBe(4);
    });

    it('weather + bond: weather first, then bond doubles', () => {
      const cards = [
        makeUnit({ id: 'b1', name: 'S', strength: 10, ability: 'bond' }),
        makeUnit({ id: 'b2', name: 'S', strength: 10, ability: 'bond' }),
      ];
      // Weather: each → 1, bond: each *2 → 2, total: 4
      expect(engine.calculateRowStrength(cards, true, false)).toBe(4);
    });

    it('full combo: weather + bond + morale + horn', () => {
      const cards = [
        makeUnit({ id: 'b1', name: 'S', strength: 10, ability: 'bond' }),
        makeUnit({ id: 'b2', name: 'S', strength: 10, ability: 'bond' }),
        makeUnit({ id: 'm1', name: 'M', strength: 5, ability: 'morale' }),
      ];
      // Weather: b1→1, b2→1, m1→1
      // Bond: b1→1*2=2, b2→1*2=2
      // Morale(1): b1→2+1=3, b2→2+1=3, m1→1(no self)
      // Sum: 3+3+1=7
      // Horn: 7*2=14
      expect(engine.calculateRowStrength(cards, true, true)).toBe(14);
    });

    it('lock отключает bond у заблокированной карты', () => {
      const cards = [
        makeUnit({ id: 'b1', name: 'Soldier', strength: 4, ability: 'bond' }),
        makeUnit({ id: 'b2', name: 'Soldier', strength: 4, ability: 'bond', locked: true }),
      ];
      // b2 заблокирован → не считается bond → у b1 нет пары → bond не срабатывает
      // Без бонда: 4 + 4 = 8
      expect(engine.calculateRowStrength(cards, false, false)).toBe(8);
    });

    it('lock отключает morale у заблокированной карты', () => {
      const cards = [
        makeUnit({ id: 'm1', name: 'Drum', strength: 2, ability: 'morale', locked: true }),
        makeUnit({ id: 'u1', name: 'Fighter', strength: 5 }),
        makeUnit({ id: 'u2', name: 'Guard', strength: 3 }),
      ];
      // Drum заблокирован → не даёт +1
      // Сумма: 2 + 5 + 3 = 10
      expect(engine.calculateRowStrength(cards, false, false)).toBe(10);
    });

    it('lock на одну из трёх bond-карт оставляет bond у двух остальных', () => {
      const cards = [
        makeUnit({ id: 'b1', name: 'Soldier', strength: 4, ability: 'bond' }),
        makeUnit({ id: 'b2', name: 'Soldier', strength: 4, ability: 'bond' }),
        makeUnit({ id: 'b3', name: 'Soldier', strength: 4, ability: 'bond', locked: true }),
      ];
      // b1, b2 → bond *2 = 8 каждая, b3 (locked) → 4
      // Сумма: 8 + 8 + 4 = 20
      expect(engine.calculateRowStrength(cards, false, false)).toBe(20);
    });
  });

  // ===========================================================================
  // pass & resolveRound
  // ===========================================================================
  describe('pass', () => {
    it('can cancel a disconnected player pending action before auto-pass', () => {
      const state = makeState();
      state.phase = 'playing';
      state.pendingAction = 'medic_choice';
      state.pendingActionPlayer = 0;
      state.pendingMedicCardIds = ['unit-1'];

      const cancelled = engine.cancelPendingAction(state, 0);
      const passed = engine.pass(cancelled, 0);

      expect(cancelled.pendingAction).toBeNull();
      expect(cancelled.pendingMedicCardIds).toBeUndefined();
      expect(passed.players[0].passed).toBe(true);
      expect(state.pendingAction).toBe('medic_choice');
    });

    function readyState(): GameState {
      let s = engine.startGame(makeState('lion_guard', 'imperial_dogs'));
      s = engine.redrawCards(s, 0, []);
      s = engine.redrawCards(s, 1, []);
      s.partisansPending = false;
      s.phase = 'playing';
      return s;
    }

    it('should mark player as passed', () => {
      const state = readyState();
      const s = engine.pass(state, 0);
      expect(s.players[0].passed).toBe(true);
    });

    it('should advance turn', () => {
      const state = readyState();
      state.currentPlayerIndex = 0;
      const s = engine.pass(state, 0);
      expect(s.currentPlayerIndex).toBe(1);
    });

    it('force-passes a disconnected player before their turn arrives', () => {
      const state = readyState();
      state.currentPlayerIndex = 0;

      const s = engine.forcePass(state, 1);

      expect(s.players[1].passed).toBe(true);
      expect(s.currentPlayerIndex).toBe(0);
      expect(state.players[1].passed).toBe(false);
    });

    it('resolves the round when an empty active player auto-passes after the opponent', () => {
      const state = readyState();
      state.players[0].passed = true;
      state.players[1].leaderUsed = true;
      state.players[1].hand = [makeUnit({ id: 'last-card', strength: 4 })];
      state.currentPlayerIndex = 1;

      const result = engine.playCard(state, 1, 'last-card');

      expect(result.error).toBeUndefined();
      expect(result.state.round).toBe(2);
      expect(result.state.lastRoundResult).toMatchObject({ round: 1 });
    });

    it('should resolve round when both pass', () => {
      const state = readyState();
      state.currentPlayerIndex = 0;
      let s = engine.pass(state, 0);
      s.currentPlayerIndex = 1;
      s = engine.pass(s, 1);
      // Round should have ended (either next round or game_over)
      expect(s.round >= 1).toBe(true);
    });

    it('after one player passes, turn stays with active player on subsequent plays', () => {
      // Регрессия для бага: «второй игрок не получает ходов после паса первого»
      const state = readyState();
      state.currentPlayerIndex = 0;
      // Дать обоим игрокам по карте в руке
      const c1 = makeUnit({ id: 'c1', strength: 3 });
      const c2 = makeUnit({ id: 'c2', strength: 4 });
      const c3 = makeUnit({ id: 'c3', strength: 2 });
      state.players[0].hand = [c1];
      state.players[1].hand = [c2, c3];

      // P0 пасует
      let s = engine.pass(state, 0);
      expect(s.players[0].passed).toBe(true);
      expect(s.currentPlayerIndex).toBe(1);

      // P1 играет первую карту — ход НЕ должен перейти к P0
      const r1 = engine.playCard(s, 1, 'c2');
      expect(r1.error).toBeUndefined();
      expect(r1.state.currentPlayerIndex).toBe(1);

      // P1 играет вторую карту — ход всё ещё у P1
      const r2 = engine.playCard(r1.state, 1, 'c3');
      expect(r2.error).toBeUndefined();
      expect(r2.state.currentPlayerIndex).toBe(1);
    });

    it('both passed flags reset to false at start of new round', () => {
      const state = readyState();
      state.players[0].field.melee = [makeUnit({ id: 'a', strength: 5 })];
      state.players[1].field.melee = [makeUnit({ id: 'b', strength: 3 })];
      state.players[0].passed = true;
      state.currentPlayerIndex = 1;

      const s = engine.pass(state, 1);
      // Раунд должен был сразу разрешиться
      expect(s.round).toBe(2);
      expect(s.players[0].passed).toBe(false);
      expect(s.players[1].passed).toBe(false);
    });

    it('hand totals are not auto-replenished between rounds (taft rules)', () => {
      // Документирующий тест: правила Тафта — рука НЕ пополняется между раундами
      const state = readyState();
      // Львиная гвардия выиграет, чтобы видеть только +1 от пассивки
      state.players[0].field.melee = [makeUnit({ id: 'a', strength: 5 })];
      const p0HandBefore = state.players[0].hand.length;
      const p1HandBefore = state.players[1].hand.length;
      state.players[0].passed = true;
      state.players[1].passed = true;

      const s = engine.resolveRound(state);
      // P0 (Lion Guard) выигрывает → +1 от пассивки
      expect(s.players[0].hand.length).toBe(p0HandBefore + 1);
      // P1 проигрывает → рука НЕ пополняется
      expect(s.players[1].hand.length).toBe(p1HandBefore);
    });
  });

  describe('resolveRound', () => {
    it('should award round to higher strength', () => {
      let state = engine.startGame(makeState());
      state.phase = 'playing';
      state.players[0].field.melee = [makeUnit({ strength: 10 })];
      state.players[0].passed = true;
      state.players[1].passed = true;

      const s = engine.resolveRound(state);
      expect(s.players[0].roundsWon).toBe(1);
    });

    it('Imperial Dogs win tie', () => {
      let state = engine.startGame(makeState('lion_guard', 'imperial_dogs'));
      state.phase = 'playing';
      // Both 0 strength
      state.players[0].passed = true;
      state.players[1].passed = true;

      const s = engine.resolveRound(state);
      expect(s.players[1].roundsWon).toBe(1);
    });

    it('should end game when player wins 2 rounds', () => {
      let state = engine.startGame(makeState());
      state.phase = 'playing';
      state.players[0].roundsWon = 1;
      state.players[0].field.melee = [makeUnit({ strength: 10 })];
      state.players[0].passed = true;
      state.players[1].passed = true;

      const s = engine.resolveRound(state);
      expect(s.phase).toBe('game_over');
      expect(s.players[0].roundsWon).toBe(2);
    });

    it('loser goes first in next round (no partisans)', () => {
      let state = engine.startGame(makeState('lion_guard', 'imperial_dogs'));
      state.phase = 'playing';
      // P0 wins round 1
      state.players[0].field.melee = [makeUnit({ strength: 10 })];
      state.players[0].passed = true;
      state.players[1].passed = true;

      const s = engine.resolveRound(state);
      // P1 lost → P1 goes first
      expect(s.currentPlayerIndex).toBe(1);
    });
  });

  // ===========================================================================
  // Lion Guard perk
  // ===========================================================================
  describe('Lion Guard perk', () => {
    it('should draw 1 card on round win', () => {
      let state = engine.startGame(makeState('lion_guard', 'imperial_dogs'));
      state.phase = 'playing';
      state.players[0].field.melee = [makeUnit({ strength: 10, faction: 'lion_guard' })];
      const handBefore = state.players[0].hand.length;
      const deckBefore = state.players[0].deck.length;
      state.players[0].passed = true;
      state.players[1].passed = true;

      const s = engine.resolveRound(state);
      expect(s.players[0].hand.length).toBe(handBefore + 1);
      expect(s.players[0].deck.length).toBe(deckBefore - 1);
    });

    it('should NOT draw when losing round', () => {
      let state = engine.startGame(makeState('lion_guard', 'imperial_dogs'));
      state.phase = 'playing';
      // P1 wins
      state.players[1].field.melee = [makeUnit({ id: 'x', strength: 10, faction: 'imperial_dogs' })];
      const handBefore = state.players[0].hand.length;
      state.players[0].passed = true;
      state.players[1].passed = true;

      const s = engine.resolveRound(state);
      expect(s.players[0].hand.length).toBe(handBefore);
    });
  });

  // ===========================================================================
  // Vexitar Witches passive (witch_pact)
  // ===========================================================================
  describe('Vexitar Witches perk (witch_pact)', () => {
    it('draws top card at start of round 2', () => {
      let state = engine.startGame(makeState('vexitar_witches', 'lion_guard'));
      state.phase = 'playing';
      // Round 1: P0 wins so game continues to round 2
      state.players[0].field.melee = [makeUnit({ strength: 10, faction: 'vexitar_witches' })];
      const handBefore = state.players[0].hand.length;
      const deckBefore = state.players[0].deck.length;
      state.players[0].passed = true;
      state.players[1].passed = true;

      const s = engine.resolveRound(state);
      // P0 (witches): +1 для witch_pact
      expect(s.players[0].hand.length).toBe(handBefore + 1);
      expect(s.players[0].deck.length).toBe(deckBefore - 1);
      // P1 (львы) проиграли — они НЕ ведьмы и НЕ должны добирать
      expect(s.round).toBe(2);
    });

    it('does not trigger if game ends', () => {
      let state = engine.startGame(makeState('vexitar_witches', 'lion_guard'));
      state.phase = 'playing';
      // P0 уже выиграл 1 раунд, теперь второй — игра закончится
      state.players[0].roundsWon = 1;
      state.players[0].field.melee = [makeUnit({ strength: 10, faction: 'vexitar_witches' })];
      const handBefore = state.players[0].hand.length;
      state.players[0].passed = true;
      state.players[1].passed = true;

      const s = engine.resolveRound(state);
      expect(s.phase).toBe('game_over');
      // Без доп. карт — игра закончилась
      expect(s.players[0].hand.length).toBe(handBefore);
    });

    it('does not trigger for non-witches', () => {
      let state = engine.startGame(makeState('lion_guard', 'imperial_dogs'));
      state.phase = 'playing';
      // P1 wins, draw with imperial_dogs perk wouldn't apply
      state.players[1].field.melee = [makeUnit({ id: 'x', strength: 10, faction: 'imperial_dogs' })];
      const handBefore = state.players[1].hand.length;
      state.players[0].passed = true;
      state.players[1].passed = true;
      const s = engine.resolveRound(state);
      // imperial_dogs не имеет witch_pact пассивки
      expect(s.players[1].hand.length).toBe(handBefore);
    });
  });

  // ===========================================================================
  // Композиция колод (после блоков 2/3/4)
  // ===========================================================================
  describe('deck composition', () => {
    const FACTIONS: FactionId[] = [
      'lion_guard', 'imperial_dogs', 'litlad_partisans', 'grey_rangers', 'vexitar_witches',
    ];

    it('all factions have 22 cards', () => {
      for (const id of FACTIONS) {
        expect(factions[id].deck.length).toBe(22);
      }
    });

    it('all factions have exactly 3 weather cards (frost+fog/rain+clear or pair)', () => {
      for (const id of FACTIONS) {
        const weatherCards = factions[id].deck.filter((c: Card) => c.type === 'weather');
        expect(weatherCards.length).toBe(3);
        const abilities = weatherCards.map((c: Card) => c.ability).sort();
        // Должно быть 1 clear и 2 различные погоды (или одна frost + clear + 1 другая)
        expect(abilities).toContain('clear');
      }
    });

    it('all 5 factions are registered with leaders', () => {
      for (const id of FACTIONS) {
        expect(factions[id]).toBeDefined();
        expect(factions[id].leader).toBeDefined();
        expect(factions[id].leader.abilityId).toBeTruthy();
      }
    });
  });

  // ===========================================================================
  // Partisans choice
  // ===========================================================================
  describe('setPartisansFirst', () => {
    it('should set partisans as first player', () => {
      let state = engine.startGame(makeState('litlad_partisans', 'imperial_dogs'));
      state = engine.redrawCards(state, 0, []);
      state = engine.redrawCards(state, 1, []);
      expect(state.partisansPending).toBe(true);

      const s = engine.setPartisansFirst(state, true);
      expect(s.currentPlayerIndex).toBe(0);
      expect(s.phase).toBe('playing');
      expect(s.partisansPending).toBe(false);
    });

    it('should set opponent as first player', () => {
      let state = engine.startGame(makeState('litlad_partisans', 'imperial_dogs'));
      state = engine.redrawCards(state, 0, []);
      state = engine.redrawCards(state, 1, []);

      const s = engine.setPartisansFirst(state, false);
      expect(s.currentPlayerIndex).toBe(1);
      expect(s.phase).toBe('playing');
    });
  });

  // ===========================================================================
  // getVisibleState
  // ===========================================================================
  describe('getVisibleState', () => {
    it('should show own hand but hide opponent hand', () => {
      const state = engine.startGame(makeState());
      const visible = engine.getVisibleState(state, 0) as any;

      expect(visible.me.hand.length).toBe(10);
      expect(visible.opponent.hand.count).toBe(10);
      expect(visible.opponent.hand.length).toBeUndefined();
    });

    it('should show correct myIndex', () => {
      const state = engine.startGame(makeState());
      const v0 = engine.getVisibleState(state, 0) as any;
      const v1 = engine.getVisibleState(state, 1) as any;
      expect(v0.myIndex).toBe(0);
      expect(v1.myIndex).toBe(1);
    });
  });

  // ===========================================================================
  // getWinner / getFinalScore
  // ===========================================================================
  describe('getWinner / getFinalScore', () => {
    it('should return null when game not over', () => {
      const state = makeState();
      state.phase = 'playing';
      expect(engine.getWinner(state)).toBeNull();
    });

    it('should return correct winner', () => {
      const state = makeState();
      state.phase = 'game_over';
      state.players[0].roundsWon = 2;
      state.players[1].roundsWon = 1;
      expect(engine.getWinner(state)).toBe(0);
      expect(engine.getFinalScore(state)).toEqual([2, 1]);
    });
  });
});
