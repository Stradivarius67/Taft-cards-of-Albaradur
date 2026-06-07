import { describe, it, expect } from 'vitest';
import {
  applySpy, applyMedic, applyMedicChoice, applyDecoy,
  applyWeather, applyClear, applyHorn,
  applyScorch, applyMuster, applyDrain, applyLock,
} from '../src/game/effects.js';
import { GameState, Card, PlayerState, FactionId } from '../src/types.js';

function makePlayer(id: string, faction: FactionId = 'lion_guard'): PlayerState {
  return {
    id,
    faction,
    hand: [],
    deck: [
      { id: 'd1', name: 'DeckCard1', faction, type: 'unit', row: 'melee', strength: 3, ability: 'none' },
      { id: 'd2', name: 'DeckCard2', faction, type: 'unit', row: 'melee', strength: 4, ability: 'none' },
      { id: 'd3', name: 'DeckCard3', faction, type: 'unit', row: 'ranged', strength: 5, ability: 'none' },
    ],
    discard: [],
    passed: false,
    roundsWon: 0,
    field: { melee: [], ranged: [], siege: [] },
    hornActive: { melee: false, ranged: false, siege: false },
    leaderUsed: false,
  };
}

function makeState(): GameState {
  return {
    id: 'TEST',
    phase: 'playing',
    players: [makePlayer('p0'), makePlayer('p1', 'imperial_dogs')],
    currentPlayerIndex: 0,
    round: 1,
    weather: { frost: false, fog: false, rain: false },
    log: [],
    redrawsDone: [0, 1],
  };
}

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'c1', name: 'Card', faction: 'lion_guard',
    type: 'unit', row: 'melee', strength: 5, ability: 'none',
    ...overrides,
  };
}

describe('Effects (immutable)', () => {
  // ===========================================================================
  // Иммутабельность
  // ===========================================================================
  describe('immutability', () => {
    it('applySpy should not mutate input state', () => {
      const state = makeState();
      const card = makeCard({ ability: 'spy', row: 'melee' });
      const deckLenBefore = state.players[0].deck.length;
      applySpy(state, 0, card);
      expect(state.players[0].deck.length).toBe(deckLenBefore);
      expect(state.players[1].field.melee.length).toBe(0);
    });

    it('applyWeather should not mutate input state', () => {
      const state = makeState();
      const wCard = makeCard({ type: 'weather', ability: 'frost', strength: 0 });
      applyWeather(state, 'frost', wCard, 0);
      expect(state.weather.frost).toBe(false);
    });

    it('applyHorn should not mutate input state', () => {
      const state = makeState();
      const hornCard = makeCard({ type: 'special', ability: 'horn', strength: 0 });
      applyHorn(state, 0, 'melee', hornCard);
      expect(state.players[0].hornActive.melee).toBe(false);
    });
  });

  // ===========================================================================
  // applySpy
  // ===========================================================================
  describe('applySpy', () => {
    it('should place card on opponent field and draw 2 cards', () => {
      const state = makeState();
      const spyCard = makeCard({ id: 'spy1', name: 'Spy', ability: 'spy', row: 'ranged' });

      const result = applySpy(state, 0, spyCard);

      expect(result.players[1].field.ranged.length).toBe(1);
      expect(result.players[1].field.ranged[0].id).toBe('spy1');
      expect(result.players[0].hand.length).toBe(2);
      expect(result.players[0].deck.length).toBe(1);
    });

    it('should draw fewer than 2 if deck is small', () => {
      const state = makeState();
      state.players[0].deck = [makeCard({ id: 'd1' })];
      const spyCard = makeCard({ id: 'spy1', ability: 'spy', row: 'melee' });

      const result = applySpy(state, 0, spyCard);
      expect(result.players[0].hand.length).toBe(1);
    });
  });

  // ===========================================================================
  // applyMedic / applyMedicChoice
  // ===========================================================================
  describe('applyMedic', () => {
    it('should place medic on field and return discard units as choices', () => {
      const state = makeState();
      const discarded = makeCard({ id: 'disc1', name: 'Dead', row: 'melee' });
      state.players[0].discard = [discarded];
      const medicCard = makeCard({ id: 'med1', ability: 'medic', row: 'ranged', strength: 1 });

      const { state: s, pendingChoice } = applyMedic(state, 0, medicCard);

      // Medic placed on field
      expect(s.players[0].field.ranged.some(c => c.id === 'med1')).toBe(true);
      // Pending choice contains discarded unit
      expect(pendingChoice.length).toBe(1);
      expect(pendingChoice[0].id).toBe('disc1');
    });

    it('should not include non-unit cards in pending choice', () => {
      const state = makeState();
      state.players[0].discard = [
        makeCard({ id: 'w1', type: 'weather', ability: 'frost', strength: 0 }),
      ];
      const medicCard = makeCard({ id: 'med1', ability: 'medic', row: 'melee', strength: 1 });

      const { pendingChoice } = applyMedic(state, 0, medicCard);
      expect(pendingChoice.length).toBe(0);
    });
  });

  describe('applyMedicChoice', () => {
    it('should revive chosen card to field', () => {
      const state = makeState();
      const discarded = makeCard({ id: 'disc1', row: 'siege' });
      state.players[0].discard = [discarded];

      const s = applyMedicChoice(state, 0, 'disc1');

      expect(s.players[0].discard.length).toBe(0);
      expect(s.players[0].field.siege.some(c => c.id === 'disc1')).toBe(true);
    });

    it('should do nothing on null choice', () => {
      const state = makeState();
      state.players[0].discard = [makeCard({ id: 'disc1' })];

      const s = applyMedicChoice(state, 0, null);
      expect(s.players[0].discard.length).toBe(1);
    });

    it('revived card ability should NOT trigger (no chains)', () => {
      const state = makeState();
      // Discard contains another medic
      const discardedMedic = makeCard({ id: 'med2', ability: 'medic', row: 'melee', strength: 1 });
      state.players[0].discard = [discardedMedic];

      // applyMedicChoice simply places card on field — no further prompts
      const s = applyMedicChoice(state, 0, 'med2');
      expect(s.players[0].field.melee.some(c => c.id === 'med2')).toBe(true);
      // No chain — function returns plain state, not { state, pendingChoice }
    });
  });

  // ===========================================================================
  // applyDecoy
  // ===========================================================================
  describe('applyDecoy', () => {
    it('should return target card to hand', () => {
      const state = makeState();
      const fieldCard = makeCard({ id: 'fc1', name: 'Fighter', row: 'melee' });
      state.players[0].field.melee = [fieldCard];
      const decoyCard = makeCard({ id: 'dec1', type: 'special', ability: 'decoy', strength: 0 });

      const { state: s, error } = applyDecoy(state, 0, 'fc1', decoyCard);

      expect(error).toBeUndefined();
      expect(s.players[0].field.melee.length).toBe(0);
      expect(s.players[0].hand.some(c => c.id === 'fc1')).toBe(true);
      expect(s.players[0].discard.some(c => c.id === 'dec1')).toBe(true);
    });

    it('should reject non-unit target', () => {
      const state = makeState();
      const specialCard = makeCard({ id: 'sp1', type: 'special', row: 'melee', ability: 'none' });
      state.players[0].field.melee = [specialCard];
      const decoyCard = makeCard({ id: 'dec1', type: 'special', ability: 'decoy', strength: 0 });

      const { error } = applyDecoy(state, 0, 'sp1', decoyCard);
      expect(error).toBeDefined();
      expect(error).toContain('юнит');
    });

    it('should return error if target not found', () => {
      const state = makeState();
      const decoyCard = makeCard({ id: 'dec1', type: 'special', ability: 'decoy', strength: 0 });

      const { error } = applyDecoy(state, 0, 'nonexistent', decoyCard);
      expect(error).toBeDefined();
    });

    it('should reject opponent spy on our field (different faction)', () => {
      const state = makeState();
      // Шпион противника лежит на нашем поле — owner=1
      const enemySpy = makeCard({
        id: 'spy1', faction: 'imperial_dogs',
        ability: 'spy', row: 'ranged', owner: 1,
      });
      state.players[0].field.ranged = [enemySpy];
      const decoyCard = makeCard({ id: 'dec1', type: 'special', ability: 'decoy', strength: 0 });

      const { state: s, error } = applyDecoy(state, 0, 'spy1', decoyCard);
      expect(error).toBeDefined();
      expect(error).toContain('противника');
      // Поле не должно измениться
      expect(s.players[0].field.ranged.length).toBe(1);
    });

    it('should reject opponent spy on our field even in mirror match (same faction)', () => {
      const state = makeState();
      // Зеркальный матч: оба Lion Guard. Шпион пришёл с owner=1.
      state.players[1].faction = 'lion_guard';
      const enemySpy = makeCard({
        id: 'spy1', faction: 'lion_guard',
        ability: 'spy', row: 'ranged', owner: 1,
      });
      state.players[0].field.ranged = [enemySpy];
      const decoyCard = makeCard({ id: 'dec1', type: 'special', ability: 'decoy', strength: 0 });

      const { error } = applyDecoy(state, 0, 'spy1', decoyCard);
      expect(error).toBeDefined();
      expect(error).toContain('противника');
    });

    it('should clear owner and strengthModifier on retrieved card', () => {
      const state = makeState();
      // Своя карта с временным бафом
      const buffed = makeCard({
        id: 'fc1', name: 'Boosted', row: 'melee',
        strength: 5, strengthModifier: 3,
      });
      state.players[0].field.melee = [buffed];
      const decoyCard = makeCard({ id: 'dec1', type: 'special', ability: 'decoy', strength: 0 });

      const { state: s, error } = applyDecoy(state, 0, 'fc1', decoyCard);
      expect(error).toBeUndefined();
      const inHand = s.players[0].hand.find(c => c.id === 'fc1');
      expect(inHand).toBeDefined();
      expect(inHand!.owner).toBeUndefined();
      expect(inHand!.strengthModifier).toBeUndefined();
    });
  });

  // ===========================================================================
  // applySpy: проверка owner
  // ===========================================================================
  describe('applySpy → owner field', () => {
    it('should mark spy with owner=playerIndex when placed on opponent field', () => {
      const state = makeState();
      const spyCard = makeCard({ id: 'spy1', ability: 'spy', row: 'ranged' });

      const result = applySpy(state, 0, spyCard);
      const placed = result.players[1].field.ranged.find(c => c.id === 'spy1');
      expect(placed).toBeDefined();
      expect(placed!.owner).toBe(0);
    });
  });

  // ===========================================================================
  // applyWeather
  // ===========================================================================
  describe('applyWeather', () => {
    const wCard = makeCard({ type: 'weather', ability: 'frost', strength: 0 });

    it('should activate frost', () => {
      const s = applyWeather(makeState(), 'frost', wCard, 0);
      expect(s.weather.frost).toBe(true);
    });

    it('should activate fog', () => {
      const s = applyWeather(makeState(), 'fog', wCard, 0);
      expect(s.weather.fog).toBe(true);
    });

    it('should activate rain', () => {
      const s = applyWeather(makeState(), 'rain', wCard, 0);
      expect(s.weather.rain).toBe(true);
    });
  });

  // ===========================================================================
  // applyClear
  // ===========================================================================
  describe('applyClear', () => {
    it('should clear all weather', () => {
      const state = makeState();
      state.weather = { frost: true, fog: true, rain: true };
      const clearCard = makeCard({ type: 'weather', ability: 'clear', strength: 0 });

      const s = applyClear(state, clearCard, 0);
      expect(s.weather.frost).toBe(false);
      expect(s.weather.fog).toBe(false);
      expect(s.weather.rain).toBe(false);
    });
  });

  // ===========================================================================
  // applyHorn
  // ===========================================================================
  describe('applyHorn', () => {
    const hornCard = makeCard({ type: 'special', ability: 'horn', strength: 0 });

    it('should activate horn on target row', () => {
      const { state: s } = applyHorn(makeState(), 0, 'melee', hornCard);
      expect(s.players[0].hornActive.melee).toBe(true);
      expect(s.players[0].hornActive.ranged).toBe(false);
    });

    it('should reject double horn on same row', () => {
      const state = makeState();
      state.players[0].hornActive.siege = true;
      const { error } = applyHorn(state, 0, 'siege', hornCard);
      expect(error).toBeDefined();
      expect(error).toContain('Рожок уже');
    });

    it('should add horn card to discard', () => {
      const { state: s } = applyHorn(makeState(), 0, 'ranged', hornCard);
      expect(s.players[0].discard.some(c => c.ability === 'horn')).toBe(true);
    });
  });

  // ===========================================================================
  // applyScorch
  // ===========================================================================
  describe('applyScorch', () => {
    const scorchCard = makeCard({ id: 'scorch', type: 'special', ability: 'scorch', strength: 0 });

    it('сжигает сильнейшую карту у обоих игроков', () => {
      const state = makeState();
      state.players[0].field.melee = [
        makeCard({ id: 'a', strength: 8 }),
        makeCard({ id: 'b', strength: 5 }),
      ];
      state.players[1].field.ranged = [makeCard({ id: 'c', strength: 8, row: 'ranged' })];
      const s = applyScorch(state, 0, scorchCard);
      expect(s.players[0].field.melee.some(c => c.id === 'a')).toBe(false);
      expect(s.players[1].field.ranged.some(c => c.id === 'c')).toBe(false);
      expect(s.players[0].field.melee.some(c => c.id === 'b')).toBe(true);
    });

    it('сжигает несколько карт с одинаковой максимальной силой', () => {
      const state = makeState();
      state.players[0].field.melee = [
        makeCard({ id: 'a', strength: 6 }),
        makeCard({ id: 'b', strength: 6 }),
        makeCard({ id: 'c', strength: 6 }),
      ];
      state.players[1].field.melee = [makeCard({ id: 'd', strength: 6 })];
      const s = applyScorch(state, 0, scorchCard);
      expect(s.players[0].field.melee.length).toBe(0);
      expect(s.players[1].field.melee.length).toBe(0);
      expect(s.players[0].discard.length).toBeGreaterThanOrEqual(4);
    });

    it('учитывает strengthModifier при поиске максимума', () => {
      const state = makeState();
      state.players[0].field.melee = [
        makeCard({ id: 'a', strength: 5, strengthModifier: 4 }), // эффективно 9
        makeCard({ id: 'b', strength: 8 }),
      ];
      const s = applyScorch(state, 0, scorchCard);
      expect(s.players[0].field.melee.some(c => c.id === 'a')).toBe(false);
      expect(s.players[0].field.melee.some(c => c.id === 'b')).toBe(true);
    });

    it('ничего не сжигает, если на поле нет юнитов, но всё равно идёт в сброс', () => {
      const state = makeState();
      const s = applyScorch(state, 0, scorchCard);
      expect(s.players[0].discard.some(c => c.id === 'scorch')).toBe(true);
    });

    it('очищает strengthModifier у карт, отправленных в сброс', () => {
      const state = makeState();
      state.players[0].field.melee = [
        makeCard({ id: 'a', strength: 5, strengthModifier: 3 }),
      ];
      const s = applyScorch(state, 0, scorchCard);
      const discarded = s.players[0].discard.find(c => c.id === 'a');
      expect(discarded).toBeDefined();
      expect(discarded?.strengthModifier).toBeUndefined();
    });
  });

  // ===========================================================================
  // applyMuster
  // ===========================================================================
  describe('applyMuster', () => {
    it('призывает все одноимённые карты из колоды', () => {
      const state = makeState();
      const partisan = (id: string): Card =>
        makeCard({ id, name: 'Партизан', faction: 'litlad_partisans', ability: 'muster' });
      state.players[0].deck = [
        partisan('p2'),
        makeCard({ id: 'other', name: 'Other' }),
        partisan('p3'),
      ];
      const s = applyMuster(state, 0, partisan('p1'));
      expect(s.players[0].field.melee.length).toBe(3);
      expect(s.players[0].deck.length).toBe(1);
      expect(s.players[0].deck[0].id).toBe('other');
    });

    it('не трогает разноимённые карты', () => {
      const state = makeState();
      state.players[0].deck = [
        makeCard({ id: 'x', name: 'Foo' }),
        makeCard({ id: 'y', name: 'Bar' }),
      ];
      const card = makeCard({ id: 'src', name: 'Solo', ability: 'muster' });
      const s = applyMuster(state, 0, card);
      expect(s.players[0].field.melee.length).toBe(1);
      expect(s.players[0].deck.length).toBe(2);
    });

    it('flexibleRow: использует переданный targetRow', () => {
      const state = makeState();
      const card = makeCard({ id: 'src', name: 'Wisp', flexibleRow: true, row: undefined, ability: 'muster' });
      state.players[0].deck = [
        makeCard({ id: 'x', name: 'Wisp', flexibleRow: true, row: undefined, ability: 'muster' }),
      ];
      const s = applyMuster(state, 0, card, 'siege');
      expect(s.players[0].field.siege.length).toBe(2);
      expect(s.players[0].field.melee.length).toBe(0);
    });
  });

  // ===========================================================================
  // applyDrain
  // ===========================================================================
  describe('applyDrain', () => {
    it('отнимает 2 силы у юнита противника в том же ряду', () => {
      const state = makeState();
      state.players[1].field.melee = [makeCard({ id: 'victim', strength: 5 })];
      const drainCard = makeCard({ id: 'd', strength: 4, ability: 'drain' });
      const s = applyDrain(state, 0, drainCard);
      const victim = s.players[1].field.melee[0];
      expect((victim.strength + (victim.strengthModifier ?? 0))).toBe(3);
      const drain = s.players[0].field.melee.find(c => c.id === 'd');
      expect(drain).toBeDefined();
      expect((drain!.strength + (drain!.strengthModifier ?? 0))).toBe(6);
    });

    it('уничтожает карту, если её сила падает до 0 или ниже', () => {
      const state = makeState();
      state.players[1].field.melee = [makeCard({ id: 'weak', strength: 1 })];
      const drainCard = makeCard({ id: 'd', strength: 4, ability: 'drain' });
      const s = applyDrain(state, 0, drainCard);
      expect(s.players[1].field.melee.find(c => c.id === 'weak')).toBeUndefined();
      expect(s.players[1].discard.some(c => c.id === 'weak')).toBe(true);
      const drain = s.players[0].field.melee.find(c => c.id === 'd');
      // Слил только 1, потому что у цели было 1
      expect((drain!.strength + (drain!.strengthModifier ?? 0))).toBe(5);
    });

    it('drain без целей в ряду противника просто кладётся на поле', () => {
      const state = makeState();
      const drainCard = makeCard({ id: 'd', strength: 4, ability: 'drain' });
      const s = applyDrain(state, 0, drainCard);
      const drain = s.players[0].field.melee.find(c => c.id === 'd');
      expect(drain).toBeDefined();
      expect(drain!.strengthModifier).toBeUndefined();
    });
  });

  // ===========================================================================
  // applyLock
  // ===========================================================================
  describe('applyLock', () => {
    it('помечает карту противника locked=true', () => {
      const state = makeState();
      state.players[1].field.melee = [makeCard({ id: 'victim', strength: 5, ability: 'morale' })];
      const lockCard = makeCard({ id: 'lk', strength: 4, ability: 'lock' });
      const result = applyLock(state, 0, lockCard, 'victim');
      expect(result.error).toBeUndefined();
      expect(result.state.players[1].field.melee[0].locked).toBe(true);
      expect(result.state.players[0].field.melee.some(c => c.id === 'lk')).toBe(true);
    });

    it('возвращает ошибку если цель не найдена', () => {
      const state = makeState();
      const lockCard = makeCard({ id: 'lk', strength: 4, ability: 'lock' });
      const result = applyLock(state, 0, lockCard, 'nope');
      expect(result.error).toBeDefined();
    });

    it('нельзя заблокировать не-юнит', () => {
      const state = makeState();
      state.players[1].field.siege = [
        { ...makeCard({ id: 'horn', strength: 0 }), type: 'special', ability: 'horn' },
      ];
      const lockCard = makeCard({ id: 'lk', strength: 4, ability: 'lock' });
      const result = applyLock(state, 0, lockCard, 'horn');
      expect(result.error).toBeDefined();
    });
  });
});
