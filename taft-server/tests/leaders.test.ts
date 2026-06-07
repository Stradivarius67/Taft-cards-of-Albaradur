import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/game/engine.js';
import { GameState, PlayerState, Card, FactionId, CardRow } from '../src/types.js';

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

function makeState(f0: FactionId = 'lion_guard', f1: FactionId = 'imperial_dogs'): GameState {
  return {
    id: 'TEST',
    phase: 'playing',
    players: [makePlayer('p0', f0), makePlayer('p1', f1)],
    currentPlayerIndex: 0,
    round: 1,
    weather: { frost: false, fog: false, rain: false },
    log: [],
    redrawsDone: [0, 1],
  };
}

function makeUnit(overrides: Partial<Card> = {}): Card {
  return {
    id: 'u1', name: 'TestUnit', faction: 'lion_guard',
    type: 'unit', row: 'melee', strength: 5, ability: 'none',
    ...overrides,
  };
}

describe('Leader Abilities', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
  });

  // ===========================================================================
  // Общие проверки
  // ===========================================================================
  describe('common validation', () => {
    it('should reject when leaderUsed === true', () => {
      const state = makeState();
      state.players[0].leaderUsed = true;
      state.players[0].field.melee = [makeUnit()];
      const { error } = engine.activateLeader(state, 0, { targetRow: 'melee' });
      expect(error).toBe('Способность лидера уже использована');
    });

    it('should reject when not your turn', () => {
      const state = makeState();
      state.currentPlayerIndex = 1;
      const { error } = engine.activateLeader(state, 0, { targetRow: 'melee' });
      expect(error).toBe('Сейчас не ваш ход');
    });

    it('should reject when not in playing phase', () => {
      const state = makeState();
      state.phase = 'redraw';
      const { error } = engine.activateLeader(state, 0, { targetRow: 'melee' });
      expect(error).toBe('Сейчас не фаза игры');
    });

    it('should reject when player passed', () => {
      const state = makeState();
      state.players[0].passed = true;
      const { error } = engine.activateLeader(state, 0, { targetRow: 'melee' });
      expect(error).toBe('Вы уже спасовали');
    });

    it('should set leaderUsed = true after activation', () => {
      const state = makeState();
      state.players[0].field.melee = [makeUnit()];
      const { state: s } = engine.activateLeader(state, 0, { targetRow: 'melee' });
      expect(s.players[0].leaderUsed).toBe(true);
    });

    it('should advance turn after activation', () => {
      const state = makeState();
      state.currentPlayerIndex = 0;
      state.players[0].field.melee = [makeUnit()];
      const { state: s } = engine.activateLeader(state, 0, { targetRow: 'melee' });
      expect(s.currentPlayerIndex).toBe(1);
    });

    it('should keep turn if opponent passed', () => {
      const state = makeState();
      state.currentPlayerIndex = 0;
      state.players[1].passed = true;
      state.players[0].field.melee = [makeUnit()];
      const { state: s } = engine.activateLeader(state, 0, { targetRow: 'melee' });
      expect(s.currentPlayerIndex).toBe(0);
    });

    it('should not mutate original state (immutability)', () => {
      const state = makeState();
      state.players[0].field.melee = [makeUnit()];
      const usedBefore = state.players[0].leaderUsed;
      engine.activateLeader(state, 0, { targetRow: 'melee' });
      expect(state.players[0].leaderUsed).toBe(usedBefore);
    });
  });

  // ===========================================================================
  // rally_the_guard (Львиная гвардия)
  // ===========================================================================
  describe('rally_the_guard', () => {
    it('should add +2 to all units in chosen row', () => {
      const state = makeState('lion_guard', 'imperial_dogs');
      state.players[0].field.melee = [
        makeUnit({ id: 'a', strength: 5 }),
        makeUnit({ id: 'b', strength: 3 }),
      ];
      const { state: s } = engine.activateLeader(state, 0, { targetRow: 'melee' });
      expect(s.players[0].field.melee[0].strengthModifier).toBe(2);
      expect(s.players[0].field.melee[1].strengthModifier).toBe(2);
    });

    it('should NOT affect cards in other rows', () => {
      const state = makeState('lion_guard', 'imperial_dogs');
      state.players[0].field.melee = [makeUnit({ id: 'a', strength: 5 })];
      state.players[0].field.ranged = [makeUnit({ id: 'b', strength: 4, row: 'ranged' })];
      const { state: s } = engine.activateLeader(state, 0, { targetRow: 'melee' });
      expect(s.players[0].field.ranged[0].strengthModifier).toBeUndefined();
    });

    it('should work on empty row (no error)', () => {
      const state = makeState('lion_guard', 'imperial_dogs');
      const { state: s, error } = engine.activateLeader(state, 0, { targetRow: 'siege' });
      expect(error).toBeUndefined();
      expect(s.players[0].leaderUsed).toBe(true);
    });

    it('should require targetRow', () => {
      const state = makeState('lion_guard', 'imperial_dogs');
      const { error } = engine.activateLeader(state, 0, {});
      expect(error).toBeDefined();
    });

    it('+2 should be accounted in calculateRowStrength (before bond)', () => {
      const state = makeState('lion_guard', 'imperial_dogs');
      // 3 bond cards with +2 modifier
      const cards: Card[] = [
        makeUnit({ id: 'b1', name: 'Soldier', strength: 5, ability: 'bond', strengthModifier: 2 }),
        makeUnit({ id: 'b2', name: 'Soldier', strength: 5, ability: 'bond', strengthModifier: 2 }),
      ];
      // base+mod: 7, bond: 7*2=14 each, total: 28
      expect(engine.calculateRowStrength(cards, false, false)).toBe(28);
    });
  });

  // ===========================================================================
  // imperial_informant (Имперские псы)
  // ===========================================================================
  describe('imperial_informant', () => {
    it('should reveal 3 random cards from opponent hand', () => {
      const state = makeState('imperial_dogs', 'lion_guard');
      state.currentPlayerIndex = 0;
      state.players[1].hand = [
        makeUnit({ id: 'h1' }), makeUnit({ id: 'h2' }),
        makeUnit({ id: 'h3' }), makeUnit({ id: 'h4' }),
      ];
      const result = engine.activateLeader(state, 0);
      expect(result.pendingAction).toBe('informant_choice');
      expect(result.informantCards!.length).toBe(3);
    });

    it('should reveal all cards if opponent has < 3', () => {
      const state = makeState('imperial_dogs', 'lion_guard');
      state.players[1].hand = [makeUnit({ id: 'h1' }), makeUnit({ id: 'h2' })];
      const result = engine.activateLeader(state, 0);
      expect(result.informantCards!.length).toBe(2);
    });

    it('should reject if opponent has 0 cards', () => {
      const state = makeState('imperial_dogs', 'lion_guard');
      state.players[1].hand = [];
      const { error } = engine.activateLeader(state, 0);
      expect(error).toBe('У противника нет карт в руке');
    });

    it('resolveInformant should discard chosen card', () => {
      const state = makeState('imperial_dogs', 'lion_guard');
      state.players[1].hand = [
        makeUnit({ id: 'h1', name: 'Target' }),
        makeUnit({ id: 'h2' }), makeUnit({ id: 'h3' }),
      ];
      const result = engine.activateLeader(state, 0);
      // Now resolve with one of the revealed cards
      const revealedId = result.informantCards![0].id;
      const { state: s2, error } = engine.resolveInformant(result.state, 0, revealedId);
      expect(error).toBeUndefined();
      expect(s2.players[1].hand.some(c => c.id === revealedId)).toBe(false);
      expect(s2.players[1].discard.some(c => c.id === revealedId)).toBe(true);
    });

    it('resolveInformant should reject cardId not in revealed', () => {
      const state = makeState('imperial_dogs', 'lion_guard');
      state.players[1].hand = [
        makeUnit({ id: 'h1' }), makeUnit({ id: 'h2' }),
        makeUnit({ id: 'h3' }), makeUnit({ id: 'h4' }),
      ];
      const result = engine.activateLeader(state, 0);
      const revealedIds = new Set(result.informantCards!.map(c => c.id));
      const notRevealed = ['h1', 'h2', 'h3', 'h4'].find(id => !revealedIds.has(id));
      if (!notRevealed) return; // all 3 revealed out of 4, one must be left

      const { error } = engine.resolveInformant(result.state, 0, notRevealed);
      expect(error).toBe('Карта не из раскрытых');
    });

    it('resolveInformant should advance turn', () => {
      const state = makeState('imperial_dogs', 'lion_guard');
      state.currentPlayerIndex = 0;
      state.players[1].hand = [makeUnit({ id: 'h1' }), makeUnit({ id: 'h2' }), makeUnit({ id: 'h3' })];
      const result = engine.activateLeader(state, 0);
      const revealedId = result.informantCards![0].id;
      const { state: s2 } = engine.resolveInformant(result.state, 0, revealedId);
      expect(s2.currentPlayerIndex).toBe(1);
      expect(s2.pendingAction).toBeNull();
    });
  });

  // ===========================================================================
  // roots_of_tungrad (Литладские партизаны)
  // ===========================================================================
  describe('roots_of_tungrad', () => {
    it('should return pendingAction roots_move', () => {
      const state = makeState('litlad_partisans', 'imperial_dogs');
      state.players[0].field.melee = [makeUnit({ id: 'c1' })];
      const result = engine.activateLeader(state, 0);
      expect(result.pendingAction).toBe('roots_move');
    });

    it('should move 1 card from melee to siege', () => {
      const state = makeState('litlad_partisans', 'imperial_dogs');
      state.players[0].field.melee = [makeUnit({ id: 'c1', row: 'melee' })];
      const activated = engine.activateLeader(state, 0);
      const { state: s, error } = engine.resolveRoots(activated.state, 0, [
        { cardId: 'c1', toRow: 'siege' },
      ]);
      expect(error).toBeUndefined();
      expect(s.players[0].field.melee.length).toBe(0);
      expect(s.players[0].field.siege.some(c => c.id === 'c1')).toBe(true);
    });

    it('should move 2 cards to different rows', () => {
      const state = makeState('litlad_partisans', 'imperial_dogs');
      state.players[0].field.melee = [
        makeUnit({ id: 'c1' }),
        makeUnit({ id: 'c2' }),
      ];
      const activated = engine.activateLeader(state, 0);
      const { state: s, error } = engine.resolveRoots(activated.state, 0, [
        { cardId: 'c1', toRow: 'ranged' },
        { cardId: 'c2', toRow: 'siege' },
      ]);
      expect(error).toBeUndefined();
      expect(s.players[0].field.melee.length).toBe(0);
      expect(s.players[0].field.ranged.some(c => c.id === 'c1')).toBe(true);
      expect(s.players[0].field.siege.some(c => c.id === 'c2')).toBe(true);
    });

    it('should allow moving non-flexibleRow cards (roots ignore restriction)', () => {
      const state = makeState('litlad_partisans', 'imperial_dogs');
      const fixedCard = makeUnit({ id: 'c1', row: 'melee', flexibleRow: false });
      state.players[0].field.melee = [fixedCard];
      const activated = engine.activateLeader(state, 0);
      const { state: s, error } = engine.resolveRoots(activated.state, 0, [
        { cardId: 'c1', toRow: 'siege' },
      ]);
      expect(error).toBeUndefined();
      expect(s.players[0].field.siege.some(c => c.id === 'c1')).toBe(true);
    });

    it('should reject > 2 moves', () => {
      const state = makeState('litlad_partisans', 'imperial_dogs');
      state.players[0].field.melee = [
        makeUnit({ id: 'c1' }), makeUnit({ id: 'c2' }), makeUnit({ id: 'c3' }),
      ];
      const activated = engine.activateLeader(state, 0);
      const { error } = engine.resolveRoots(activated.state, 0, [
        { cardId: 'c1', toRow: 'ranged' },
        { cardId: 'c2', toRow: 'siege' },
        { cardId: 'c3', toRow: 'siege' },
      ]);
      expect(error).toBe('Можно переместить максимум 2 карты');
    });

    it('should reject 0 moves', () => {
      const state = makeState('litlad_partisans', 'imperial_dogs');
      const activated = engine.activateLeader(state, 0);
      const { error } = engine.resolveRoots(activated.state, 0, []);
      expect(error).toBe('Нужно переместить хотя бы 1 карту');
    });

    it('should reject moving opponent card', () => {
      const state = makeState('litlad_partisans', 'imperial_dogs');
      state.players[1].field.melee = [makeUnit({ id: 'opp1' })];
      const activated = engine.activateLeader(state, 0);
      const { error } = engine.resolveRoots(activated.state, 0, [
        { cardId: 'opp1', toRow: 'siege' },
      ]);
      expect(error).toContain('not found');
    });

    it('should advance turn after resolveRoots', () => {
      const state = makeState('litlad_partisans', 'imperial_dogs');
      state.currentPlayerIndex = 0;
      state.players[0].field.melee = [makeUnit({ id: 'c1' })];
      const activated = engine.activateLeader(state, 0);
      const { state: s } = engine.resolveRoots(activated.state, 0, [
        { cardId: 'c1', toRow: 'ranged' },
      ]);
      expect(s.currentPlayerIndex).toBe(1);
    });
  });

  // ===========================================================================
  // blood_ritual (Серые следопыты)
  // ===========================================================================
  describe('blood_ritual', () => {
    it('should revive strongest unit from discard to field', () => {
      const state = makeState('grey_rangers', 'imperial_dogs');
      state.players[0].discard = [
        makeUnit({ id: 'd1', name: 'Weak', strength: 3, row: 'melee' }),
        makeUnit({ id: 'd2', name: 'Strong', strength: 9, row: 'siege' }),
        makeUnit({ id: 'd3', name: 'Medium', strength: 6, row: 'ranged' }),
      ];
      const { state: s } = engine.activateLeader(state, 0);
      // Strongest (9) should be on siege
      expect(s.players[0].field.siege.some(c => c.id === 'd2')).toBe(true);
      expect(s.players[0].discard.some(c => c.id === 'd2')).toBe(false);
    });

    it('should pick first when multiple equal-strength cards', () => {
      const state = makeState('grey_rangers', 'imperial_dogs');
      state.players[0].discard = [
        makeUnit({ id: 'd1', name: 'First', strength: 8, row: 'melee' }),
        makeUnit({ id: 'd2', name: 'Second', strength: 8, row: 'ranged' }),
      ];
      const { state: s } = engine.activateLeader(state, 0);
      // First found should be revived
      expect(s.players[0].field.melee.some(c => c.id === 'd1')).toBe(true);
    });

    it('revived card ability should NOT trigger (spy stays on own field)', () => {
      const state = makeState('grey_rangers', 'imperial_dogs');
      state.players[0].discard = [
        makeUnit({ id: 'spy1', name: 'SpyCard', strength: 7, row: 'ranged', ability: 'spy' }),
      ];
      const handBefore = state.players[0].hand.length;
      const { state: s } = engine.activateLeader(state, 0);
      // Spy should be on OWN field (not opponent's), no cards drawn
      expect(s.players[0].field.ranged.some(c => c.id === 'spy1')).toBe(true);
      expect(s.players[1].field.ranged.length).toBe(0);
      expect(s.players[0].hand.length).toBe(handBefore);
    });

    it('revived medic should NOT trigger medic effect', () => {
      const state = makeState('grey_rangers', 'imperial_dogs');
      state.players[0].discard = [
        makeUnit({ id: 'med1', name: 'Medic', strength: 5, row: 'melee', ability: 'medic' }),
        makeUnit({ id: 'other', name: 'Other', strength: 3, row: 'ranged' }),
      ];
      const { state: s, pendingAction } = engine.activateLeader(state, 0);
      // Medic placed on field, but no pending medic choice
      expect(s.players[0].field.melee.some(c => c.id === 'med1')).toBe(true);
      expect(pendingAction).toBeUndefined();
      // Other card still in discard
      expect(s.players[0].discard.some(c => c.id === 'other')).toBe(true);
    });

    it('should reject if discard has no unit cards', () => {
      const state = makeState('grey_rangers', 'imperial_dogs');
      state.players[0].discard = [];
      const { error } = engine.activateLeader(state, 0);
      expect(error).toBe('В сбросе нет юнитов');
    });

    it('should reject if discard only has special/weather', () => {
      const state = makeState('grey_rangers', 'imperial_dogs');
      state.players[0].discard = [
        { id: 'w1', name: 'Weather', faction: 'grey_rangers', type: 'weather', strength: 0, ability: 'frost' },
        { id: 's1', name: 'Horn', faction: 'grey_rangers', type: 'special', strength: 0, ability: 'horn' },
      ];
      const { error } = engine.activateLeader(state, 0);
      expect(error).toBe('В сбросе нет юнитов');
    });
  });

  // ===========================================================================
  // getVisibleState — leader info
  // ===========================================================================
  describe('getVisibleState with leader info', () => {
    it('should include leaderUsed for both players', () => {
      const state = makeState();
      state.players[0].leaderUsed = true;
      const visible = engine.getVisibleState(state, 0) as any;
      expect(visible.me.leaderUsed).toBe(true);
      expect(visible.opponent.leaderUsed).toBe(false);
    });

    it('should include canActivateLeader', () => {
      const state = makeState();
      state.phase = 'playing';
      state.currentPlayerIndex = 0;
      const visible = engine.getVisibleState(state, 0) as any;
      expect(visible.me.canActivateLeader).toBe(true);
    });

    it('canActivateLeader should be false when already used', () => {
      const state = makeState();
      state.phase = 'playing';
      state.currentPlayerIndex = 0;
      state.players[0].leaderUsed = true;
      const visible = engine.getVisibleState(state, 0) as any;
      expect(visible.me.canActivateLeader).toBe(false);
    });

    it('canActivateLeader should be false when not your turn', () => {
      const state = makeState();
      state.phase = 'playing';
      state.currentPlayerIndex = 1;
      const visible = engine.getVisibleState(state, 0) as any;
      expect(visible.me.canActivateLeader).toBe(false);
    });

    it('should include leaderAbility text', () => {
      const state = makeState('lion_guard', 'imperial_dogs');
      const visible = engine.getVisibleState(state, 0) as any;
      expect(visible.me.leaderAbility).toContain('Сплочение гвардии');
      expect(visible.opponent.leaderAbility).toContain('осведомитель');
    });
  });

  // ===========================================================================
  // Проклятие Гризельды (Vexitar Witches)
  // ===========================================================================
  describe('witches_curse — Гризельда Вечная', () => {
    it('-2 к силе всех unit-карт в выбранном ряду противника', () => {
      const state = makeState('vexitar_witches', 'lion_guard');
      state.players[1].field.melee = [
        makeUnit({ id: 'a', strength: 5 }),
        makeUnit({ id: 'b', strength: 4 }),
        makeUnit({ id: 'c', strength: 3 }),
      ];
      const { state: s } = engine.activateLeader(state, 0, { targetRow: 'melee' });
      const eff = (c: Card) => c.strength + (c.strengthModifier ?? 0);
      expect(s.players[1].field.melee.map(eff)).toEqual([3, 2, 1]);
    });

    it('уничтожает карту с эффективной силой ≤ 0', () => {
      const state = makeState('vexitar_witches', 'lion_guard');
      state.players[1].field.melee = [
        makeUnit({ id: 'big', strength: 5 }),
        makeUnit({ id: 'weak', strength: 2 }),
      ];
      const { state: s } = engine.activateLeader(state, 0, { targetRow: 'melee' });
      // weak (2 -> 0) уничтожен, big остался с силой 3
      expect(s.players[1].field.melee.map(c => c.id)).toEqual(['big']);
      expect(s.players[1].discard.map(c => c.id)).toContain('weak');
      // strengthModifier должен быть очищен у карты в discard
      expect(s.players[1].discard.find(c => c.id === 'weak')?.strengthModifier).toBeUndefined();
    });

    it('требует targetRow', () => {
      const state = makeState('vexitar_witches', 'lion_guard');
      const { error } = engine.activateLeader(state, 0, {});
      expect(error).toBe('witches_curse requires targetRow');
    });

    it('не трогает не-unit карты в ряду', () => {
      const state = makeState('vexitar_witches', 'lion_guard');
      const horn: Card = {
        id: 'h', name: 'horn', faction: 'lion_guard',
        type: 'special', strength: 0, ability: 'horn',
      };
      state.players[1].field.melee = [horn, makeUnit({ id: 'u', strength: 5 })];
      const { state: s } = engine.activateLeader(state, 0, { targetRow: 'melee' });
      // horn остался без модификатора, юнит ослаблен
      const hornCard = s.players[1].field.melee.find(c => c.id === 'h')!;
      expect(hornCard.strengthModifier).toBeUndefined();
      const unit = s.players[1].field.melee.find(c => c.id === 'u')!;
      expect(unit.strength + (unit.strengthModifier ?? 0)).toBe(3);
    });
  });
});
