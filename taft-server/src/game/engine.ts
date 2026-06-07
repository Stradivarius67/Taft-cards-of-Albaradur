import {
  Card, CardRow, GameState, PlayerState, WeatherEffects, FactionId, LeaderAbilityId,
} from '../types.js';
import { getDeckCopy, factions } from './factions.js';
import {
  applySpy, applyMedic, applyMedicChoice, applyDecoy,
  applyWeather, applyClear, applyHorn,
  applyScorch, applyMuster, applyDrain, applyLock,
} from './effects.js';

function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createPlayerState(id: string, faction: FactionId, playerIndex: number): PlayerState {
  const rawDeck = getDeckCopy(faction);
  // Prefix card IDs to avoid collisions in mirror matches
  const prefixedDeck = rawDeck.map(card => ({
    ...card,
    id: `p${playerIndex}_${card.id}`,
  }));
  const deck = shuffle(prefixedDeck);
  const hand = deck.splice(0, 10);
  return {
    id,
    faction,
    hand,
    deck,
    discard: [],
    passed: false,
    roundsWon: 0,
    field: { melee: [], ranged: [], siege: [] },
    hornActive: { melee: false, ranged: false, siege: false },
    leaderUsed: false,
  };
}

export class GameEngine {
  startGame(state: GameState): GameState {
    const s = cloneState(state);
    const p0 = createPlayerState(s.players[0].id, s.players[0].faction, 0);
    const p1 = createPlayerState(s.players[1].id, s.players[1].faction, 1);

    s.players = [p0, p1];
    s.phase = 'redraw';
    s.round = 1;
    s.currentPlayerIndex = 0;
    s.weather = { frost: false, fog: false, rain: false };
    s.redrawsDone = [];
    s.pendingAction = null;
    s.log = [...s.log, 'Game started, phase: redraw'];
    return s;
  }

  redrawCards(state: GameState, playerIndex: number, cardIds: string[]): GameState {
    if (state.phase !== 'redraw') return state;
    if (state.redrawsDone.includes(playerIndex)) return state;
    if (cardIds.length > 2) {
      const s = cloneState(state);
      s.log.push(`Player ${playerIndex} tried to redraw ${cardIds.length} cards (max 2)`);
      return s;
    }

    const s = cloneState(state);
    const player = s.players[playerIndex];

    for (const cid of cardIds) {
      if (!player.hand.some(c => c.id === cid)) {
        s.log.push(`Player ${playerIndex} tried to redraw non-existent card ${cid}`);
        return s;
      }
    }

    for (const cid of cardIds) {
      const idx = player.hand.findIndex(c => c.id === cid);
      if (idx === -1) continue;
      const [removed] = player.hand.splice(idx, 1);
      player.deck.push(removed);
      player.deck = shuffle(player.deck);
      if (player.deck.length > 0) {
        player.hand.push(player.deck.pop()!);
      }
    }

    s.redrawsDone.push(playerIndex);
    s.log.push(`Player ${playerIndex} redrawn ${cardIds.length} cards`);

    if (s.redrawsDone.length === 2) {
      if (this.hasPartisansPlayer(s)) {
        s.phase = 'partisans_choice';
        s.partisansPending = true;
        s.log.push('Partisans choose who goes first');
      } else {
        s.phase = 'playing';
        s.log.push('Both players redrawn, phase: playing');
      }
    }

    return s;
  }

  playCard(
    state: GameState,
    playerIndex: number,
    cardId: string,
    targetRow?: CardRow
  ): { state: GameState; pendingChoice?: Card[]; error?: string } {
    if (state.phase !== 'playing') {
      return { state, error: 'Сейчас не фаза игры' };
    }
    if (state.currentPlayerIndex !== playerIndex) {
      return { state, error: 'Сейчас не ваш ход' };
    }

    const player = state.players[playerIndex];
    if (player.passed) {
      return { state, error: 'Вы уже спасовали' };
    }

    const cardIdx = player.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) {
      return { state, error: 'Карты нет в руке' };
    }

    const card = player.hand[cardIdx];

    if (card.type === 'unit' && card.flexibleRow && !targetRow && card.ability !== 'spy') {
      return { state, error: 'Нужно выбрать ряд для этой карты' };
    }

    let s = cloneState(state);
    const sCard = s.players[playerIndex].hand[cardIdx];
    s.players[playerIndex].hand.splice(cardIdx, 1);

    // Weather
    if (sCard.type === 'weather') {
      if (sCard.ability === 'clear') {
        s = applyClear(s, sCard, playerIndex);
      } else if (sCard.ability === 'frost' || sCard.ability === 'fog' || sCard.ability === 'rain') {
        s = applyWeather(s, sCard.ability, sCard, playerIndex);
      }
      this.advanceTurn(s);
      return { state: s };
    }

    // Special: decoy
    if (sCard.ability === 'decoy') {
      if (!targetRow) {
        // Возвращаем карту в руку — играем с тем же объектом state, который не мутирован
        return { state, error: 'Приманка требует выбора цели' };
      }
      const result = applyDecoy(s, playerIndex, targetRow, sCard);
      if (result.error) {
        // Откат: возвращаем decoy в исходное состояние руки
        return { state, error: result.error };
      }
      this.advanceTurn(result.state);
      return { state: result.state };
    }

    // Special: horn
    if (sCard.ability === 'horn') {
      if (!targetRow) {
        return { state, error: 'Рожок требует выбора ряда' };
      }
      const result = applyHorn(s, playerIndex, targetRow, sCard);
      if (result.error) {
        return { state, error: result.error };
      }
      this.advanceTurn(result.state);
      return { state: result.state };
    }

    // Unit: spy
    if (sCard.ability === 'spy') {
      s = applySpy(s, playerIndex, sCard);
      this.advanceTurn(s);
      return { state: s };
    }

    // Unit: medic
    if (sCard.ability === 'medic') {
      const result = applyMedic(s, playerIndex, sCard);
      this.advanceTurn(result.state);
      if (result.pendingChoice.length > 0) {
        return { state: result.state, pendingChoice: result.pendingChoice };
      }
      return { state: result.state };
    }

    // Special: scorch (карта-special без поля, без выбора цели)
    if (sCard.ability === 'scorch') {
      s = applyScorch(s, playerIndex, sCard);
      this.advanceTurn(s);
      return { state: s };
    }

    // Unit/special: muster (одноимённые из колоды на поле)
    if (sCard.ability === 'muster') {
      s = applyMuster(s, playerIndex, sCard, targetRow);
      this.advanceTurn(s);
      return { state: s };
    }

    // Unit: drain (отнимает 2 силы у юнита противника в том же ряду)
    if (sCard.ability === 'drain') {
      s = applyDrain(s, playerIndex, sCard, targetRow);
      this.advanceTurn(s);
      return { state: s };
    }

    // Unit: lock (блокирует ability карты на поле противника)
    if (sCard.ability === 'lock') {
      if (!targetRow) {
        return { state, error: 'Lock требует выбора цели на поле противника' };
      }
      // targetRow здесь — это id целевой карты на поле противника, передаваемый
      // через тот же параметр (см. play_card на клиенте: для lock он содержит
      // cardId жертвы). Это сделано чтобы не плодить новых полей в protocol.
      // В качестве ряда для самого lock-юнита используем его card.row.
      const result = applyLock(s, playerIndex, sCard, targetRow);
      if (result.error) {
        return { state, error: result.error };
      }
      this.advanceTurn(result.state);
      return { state: result.state };
    }

    // Unit: обычная
    const row = (sCard.flexibleRow && targetRow) ? targetRow : sCard.row!;
    s.players[playerIndex].field[row].push(sCard);
    s.log.push(`Player ${playerIndex} played "${sCard.name}" to ${row}`);

    this.advanceTurn(s);
    return { state: s };
  }

  resolveMedicChoice(
    state: GameState,
    playerIndex: number,
    cardId: string | null
  ): GameState {
    return applyMedicChoice(state, playerIndex, cardId);
  }

  pass(state: GameState, playerIndex: number): GameState {
    if (state.phase !== 'playing') return state;
    if (state.currentPlayerIndex !== playerIndex) return state;

    const s = cloneState(state);
    s.players[playerIndex].passed = true;
    s.log.push(`Player ${playerIndex} passed`);

    const opponentIdx = playerIndex === 0 ? 1 : 0;
    if (s.players[opponentIdx].passed) {
      return this.resolveRound(s);
    }

    this.advanceTurn(s);
    return s;
  }

  setPartisansFirst(state: GameState, goFirst: boolean): GameState {
    if (!state.partisansPending) return state;

    const s = cloneState(state);
    const partisansIdx = this.getPartisansPlayerIndex(s);
    if (partisansIdx === -1) return state;

    s.currentPlayerIndex = goFirst
      ? (partisansIdx as 0 | 1)
      : ((partisansIdx === 0 ? 1 : 0) as 0 | 1);
    s.partisansPending = false;
    s.phase = 'playing';
    s.log.push(`Partisans chose: ${goFirst ? 'go first' : 'opponent goes first'}`);
    return s;
  }

  // ===========================================================================
  // Способности лидеров
  // ===========================================================================

  /**
   * Активировать способность лидера. Это альтернативный ход.
   */
  activateLeader(
    state: GameState,
    playerIndex: number,
    params?: { targetRow?: CardRow }
  ): { state: GameState; pendingAction?: 'informant_choice' | 'roots_move'; informantCards?: Card[]; error?: string } {
    // Общая валидация
    if (state.phase !== 'playing') {
      return { state, error: 'Сейчас не фаза игры' };
    }
    if (state.currentPlayerIndex !== playerIndex) {
      return { state, error: 'Сейчас не ваш ход' };
    }
    if (state.players[playerIndex].leaderUsed) {
      return { state, error: 'Способность лидера уже использована' };
    }
    if (state.players[playerIndex].passed) {
      return { state, error: 'Вы уже спасовали' };
    }

    const faction = state.players[playerIndex].faction;
    const abilityId = factions[faction].leader.abilityId;

    switch (abilityId) {
      case 'rally_the_guard':
        return this.activateRallyTheGuard(state, playerIndex, params?.targetRow);

      case 'imperial_informant':
        return this.activateImperialInformant(state, playerIndex);

      case 'roots_of_tungrad':
        return this.activateRootsOfTungrad(state, playerIndex);

      case 'blood_ritual':
        return this.activateBloodRitual(state, playerIndex);

      case 'witches_curse':
        return this.activateWitchesCurse(state, playerIndex, params?.targetRow);
    }
  }

  /**
   * Сплочение гвардии: все карты в выбранном ряду получают +2 к базовой силе.
   */
  private activateRallyTheGuard(
    state: GameState,
    playerIndex: number,
    targetRow?: CardRow
  ): { state: GameState; error?: string } {
    if (!targetRow) {
      return { state, error: 'rally_the_guard requires targetRow' };
    }

    const s = cloneState(state);
    const player = s.players[playerIndex];

    for (const card of player.field[targetRow]) {
      if (card.type === 'unit') {
        card.strengthModifier = (card.strengthModifier ?? 0) + 2;
      }
    }

    player.leaderUsed = true;
    s.log.push(`Player ${playerIndex} activated leader: Сплочение гвардии (+2 to ${targetRow})`);
    this.advanceTurn(s);
    return { state: s };
  }

  /**
   * Имперский осведомитель: показать 3 случайные карты из руки противника.
   * Шаг 1 — вернуть revealed карты. Шаг 2 — resolveInformant.
   */
  private activateImperialInformant(
    state: GameState,
    playerIndex: number
  ): { state: GameState; pendingAction?: 'informant_choice'; informantCards?: Card[]; error?: string } {
    const opponentIdx = playerIndex === 0 ? 1 : 0;
    const opponentHand = state.players[opponentIdx].hand;

    if (opponentHand.length === 0) {
      return { state, error: 'У противника нет карт в руке' };
    }

    const s = cloneState(state);
    const hand = [...s.players[opponentIdx].hand];
    const shuffled = shuffle(hand);
    const revealed = shuffled.slice(0, Math.min(3, shuffled.length));

    s.players[playerIndex].leaderUsed = true;
    s.pendingAction = 'informant_choice';
    s.pendingActionPlayer = playerIndex;
    s.informantRevealed = revealed.map(c => ({ ...c }));
    s.log.push(`Player ${playerIndex} activated leader: Имперский осведомитель`);

    return { state: s, pendingAction: 'informant_choice', informantCards: revealed };
  }

  /**
   * Имперский осведомитель — шаг 2: сбросить выбранную карту.
   */
  resolveInformant(
    state: GameState,
    playerIndex: number,
    cardId: string
  ): { state: GameState; error?: string } {
    if (state.pendingAction !== 'informant_choice' || state.pendingActionPlayer !== playerIndex) {
      return { state, error: 'Нет ожидающих действий осведомителя' };
    }

    // Валидация: cardId должен быть среди revealed
    const revealed = state.informantRevealed || [];
    if (!revealed.some(c => c.id === cardId)) {
      return { state, error: 'Карта не из раскрытых' };
    }

    const s = cloneState(state);
    const opponentIdx = playerIndex === 0 ? 1 : 0;
    const opponent = s.players[opponentIdx];

    const idx = opponent.hand.findIndex(c => c.id === cardId);
    if (idx === -1) {
      return { state: s, error: 'Card not found in opponent hand' };
    }

    const [discarded] = opponent.hand.splice(idx, 1);
    opponent.discard.push(discarded);

    s.pendingAction = null;
    s.pendingActionPlayer = undefined;
    s.informantRevealed = undefined;
    s.log.push(`Player ${playerIndex} used informant to discard "${discarded.name}" from opponent's hand`);
    this.advanceTurn(s);
    return { state: s };
  }

  /**
   * Корни Тунграда: шаг 1 — пометить pending, ждать moves.
   */
  private activateRootsOfTungrad(
    state: GameState,
    playerIndex: number
  ): { state: GameState; pendingAction?: 'roots_move'; error?: string } {
    const s = cloneState(state);
    s.players[playerIndex].leaderUsed = true;
    s.pendingAction = 'roots_move';
    s.pendingActionPlayer = playerIndex;
    s.log.push(`Player ${playerIndex} activated leader: Корни Тунграда`);
    return { state: s, pendingAction: 'roots_move' };
  }

  /**
   * Корни Тунграда — шаг 2: переместить до 2 карт.
   */
  resolveRoots(
    state: GameState,
    playerIndex: number,
    moves: { cardId: string; toRow: CardRow }[]
  ): { state: GameState; error?: string } {
    if (state.pendingAction !== 'roots_move' || state.pendingActionPlayer !== playerIndex) {
      return { state, error: 'Нет ожидающих действий корней' };
    }

    if (moves.length === 0) {
      return { state, error: 'Нужно переместить хотя бы 1 карту' };
    }

    if (moves.length > 2) {
      return { state, error: 'Можно переместить максимум 2 карты' };
    }

    const s = cloneState(state);
    const player = s.players[playerIndex];

    for (const move of moves) {
      let found = false;
      for (const rowName of ['melee', 'ranged', 'siege'] as CardRow[]) {
        const row = player.field[rowName];
        const idx = row.findIndex(c => c.id === move.cardId);
        if (idx !== -1) {
          const [card] = row.splice(idx, 1);
          player.field[move.toRow].push(card);
          s.log.push(`Roots moved "${card.name}" from ${rowName} to ${move.toRow}`);
          found = true;
          break;
        }
      }
      if (!found) {
        return { state, error: `Card ${move.cardId} not found on player's field` };
      }
    }

    s.pendingAction = null;
    s.pendingActionPlayer = undefined;
    this.advanceTurn(s);
    return { state: s };
  }

  /**
   * Кровавый ритуал: самая сильная unit-карта из discard → на поле.
   */
  private activateBloodRitual(
    state: GameState,
    playerIndex: number
  ): { state: GameState; error?: string } {
    const player = state.players[playerIndex];
    const unitCards = player.discard.filter(c => c.type === 'unit');

    if (unitCards.length === 0) {
      return { state, error: 'В сбросе нет юнитов' };
    }

    const s = cloneState(state);
    const sPlayer = s.players[playerIndex];
    const sUnits = sPlayer.discard.filter(c => c.type === 'unit');

    // Найти самую сильную
    let strongest = sUnits[0];
    for (let i = 1; i < sUnits.length; i++) {
      if (sUnits[i].strength > strongest.strength) {
        strongest = sUnits[i];
      }
    }

    // Убрать из discard
    const idx = sPlayer.discard.findIndex(c => c.id === strongest.id);
    sPlayer.discard.splice(idx, 1);

    // Поставить на поле (ability НЕ срабатывает)
    const row = strongest.row || 'melee';
    sPlayer.field[row].push(strongest);

    sPlayer.leaderUsed = true;
    s.log.push(`Player ${playerIndex} activated leader: Кровавый ритуал — "${strongest.name}" (${strongest.strength}) revived to ${row}`);
    this.advanceTurn(s);
    return { state: s };
  }

  /**
   * Проклятие Гризельды: -2 к силе всех unit-карт в выбранном ряду противника.
   * Карты с силой ≤ 0 уничтожаются и уходят в discard противника.
   * Это зеркало rally_the_guard — там +2 своему ряду, здесь -2 чужому.
   */
  private activateWitchesCurse(
    state: GameState,
    playerIndex: number,
    targetRow?: CardRow
  ): { state: GameState; error?: string } {
    if (!targetRow) {
      return { state, error: 'witches_curse requires targetRow' };
    }

    const s = cloneState(state);
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponent = s.players[opponentIndex];

    const survivors: Card[] = [];
    let killed = 0;
    for (const card of opponent.field[targetRow]) {
      if (card.type === 'unit') {
        card.strengthModifier = (card.strengthModifier ?? 0) - 2;
        const eff = card.strength + (card.strengthModifier ?? 0);
        if (eff <= 0) {
          const discardCopy = { ...card };
          delete discardCopy.strengthModifier;
          delete discardCopy.locked;
          delete discardCopy.owner;
          opponent.discard.push(discardCopy);
          killed += 1;
          continue;
        }
      }
      survivors.push(card);
    }
    opponent.field[targetRow] = survivors;

    s.players[playerIndex].leaderUsed = true;
    s.log.push(
      `Player ${playerIndex} activated leader: Проклятие Гризельды (-2 to opponent ${targetRow}, killed ${killed})`
    );
    this.advanceTurn(s);
    return { state: s };
  }

  // ===========================================================================
  // Подсчёт силы
  // ===========================================================================

  /**
   * Подсчёт силы ряда.
   * Строгий порядок: base+modifier → weather → bond (*2) → morale (+1) → sum → horn (*2)
   */
  calculateRowStrength(cards: Card[], weatherActive: boolean, hornActive: boolean): number {
    if (cards.length === 0) return 0;

    const effectiveStrength = new Array<number>(cards.length);

    // Шаг 1: Базовая сила + strengthModifier
    for (let i = 0; i < cards.length; i++) {
      effectiveStrength[i] = cards[i].strength + (cards[i].strengthModifier ?? 0);
    }

    // Шаг 2: Погода — все карты = 1
    if (weatherActive) {
      for (let i = 0; i < cards.length; i++) {
        if (cards[i].type === 'unit') {
          effectiveStrength[i] = 1;
        }
      }
    }

    // Шаг 3: Bond — 2+ одинаковых → каждая *2.
    // Locked-карта в группе НЕ участвует: она ни сама не удваивается,
    // ни не считается «дубликатом» для остальных.
    const bondGroups = new Map<string, number[]>();
    for (let i = 0; i < cards.length; i++) {
      if (cards[i].ability === 'bond' && !cards[i].locked) {
        const name = cards[i].name;
        if (!bondGroups.has(name)) bondGroups.set(name, []);
        bondGroups.get(name)!.push(i);
      }
    }
    for (const indices of bondGroups.values()) {
      if (indices.length >= 2) {
        for (const idx of indices) {
          effectiveStrength[idx] *= 2;
        }
      }
    }

    // Шаг 4: Morale — +1 от каждой morale всем остальным.
    // Locked morale-карта не даёт бонуса (и сама бонус получает как обычный юнит).
    const moraleCount = cards.filter(c => c.ability === 'morale' && !c.locked).length;
    for (let i = 0; i < cards.length; i++) {
      if (cards[i].ability === 'morale' && !cards[i].locked) {
        effectiveStrength[i] += Math.max(0, moraleCount - 1);
      } else {
        effectiveStrength[i] += moraleCount;
      }
    }

    // Шаг 5: Суммирование
    let rowTotal = effectiveStrength.reduce((sum, v) => sum + v, 0);

    // Шаг 6: Horn
    if (hornActive) {
      rowTotal *= 2;
    }

    return rowTotal;
  }

  calculatePlayerStrength(player: PlayerState, weather: WeatherEffects): number {
    const melee = this.calculateRowStrength(player.field.melee, weather.frost, player.hornActive.melee);
    const ranged = this.calculateRowStrength(player.field.ranged, weather.fog, player.hornActive.ranged);
    const siege = this.calculateRowStrength(player.field.siege, weather.rain, player.hornActive.siege);
    return melee + ranged + siege;
  }

  resolveRound(state: GameState): GameState {
    let s = cloneState(state);
    const s0 = this.calculatePlayerStrength(s.players[0], s.weather);
    const s1 = this.calculatePlayerStrength(s.players[1], s.weather);

    s.log.push(`Round ${s.round} scores: P0=${s0}, P1=${s1}`);

    let roundWinner: number | null = null;

    if (s0 > s1) {
      s.players[0].roundsWon++;
      roundWinner = 0;
    } else if (s1 > s0) {
      s.players[1].roundsWon++;
      roundWinner = 1;
    } else {
      const idIdx = s.players.findIndex(p => p.faction === 'imperial_dogs');
      if (idIdx !== -1) {
        s.players[idIdx].roundsWon++;
        roundWinner = idIdx;
        s.log.push('Imperial Dogs win the tie');
      } else {
        s.log.push('Tie — neither player wins the round');
      }
    }

    if (roundWinner !== null) {
      s.lastRoundLoser = roundWinner === 0 ? 1 : 0;
    } else {
      s.lastRoundLoser = null;
    }

    // Пассивка Львиной гвардии
    if (roundWinner !== null) {
      const winner = s.players[roundWinner];
      if (winner.faction === 'lion_guard' && winner.deck.length > 0) {
        winner.hand.push(winner.deck.pop()!);
        s.log.push(`Lion Guard perk: player ${roundWinner} draws 1 card`);
      }
    }

    // Пассивка Векситарских ведьм: «Ведьминский пакт» — в начале каждого
    // следующего раунда (т.е. если игра продолжается) ведьма достаёт верхнюю
    // карту своей колоды (как если бы посмотрела и решила взять).
    // Сработает только когда раунд РЕАЛЬНО будет следующим, поэтому проверим
    // условие продолжения игры ниже и применим там.

    if (s.players[0].roundsWon >= 2 || s.players[1].roundsWon >= 2) {
      s.phase = 'game_over';
      s = this.clearField(s);
      s.log.push('Game over');
      return s;
    }

    if (s.round >= 3) {
      s.phase = 'game_over';
      s = this.clearField(s);
      s.log.push('Game over after 3 rounds');
      return s;
    }

    s = this.clearField(s);

    s.round = (s.round + 1) as 1 | 2 | 3;
    s.players[0].passed = false;
    s.players[1].passed = false;
    s.weather = { frost: false, fog: false, rain: false };

    // Пассивка Векситарских ведьм («Ведьминский пакт») срабатывает в начале
    // каждого раунда кроме первого. Авто-вариант: ведьма всегда забирает
    // верхнюю карту колоды в руку. Работает для обеих сторон в зеркальном матче.
    for (let i = 0; i < 2; i++) {
      const p = s.players[i];
      if (p.faction === 'vexitar_witches' && p.deck.length > 0) {
        const top = p.deck.pop()!;
        p.hand.push(top);
        s.log.push(`Vexitar Witches perk: player ${i} witch_pact — drew "${top.name}"`);
      }
    }

    if (this.hasPartisansPlayer(s)) {
      s.phase = 'partisans_choice';
      s.partisansPending = true;
      s.log.push(`Round ${s.round} — partisans choose who goes first`);
    } else {
      s.phase = 'playing';
      if (s.lastRoundLoser !== null) {
        s.currentPlayerIndex = s.lastRoundLoser as 0 | 1;
      }
      s.log.push(`Round ${s.round} started`);
    }

    return s;
  }

  private clearField(state: GameState): GameState {
    const s = cloneState(state);

    for (let i = 0; i < 2; i++) {
      const player = s.players[i];
      const allFieldCards: { card: Card; row: CardRow }[] = [];

      for (const rowName of ['melee', 'ranged', 'siege'] as CardRow[]) {
        for (const card of player.field[rowName]) {
          allFieldCards.push({ card, row: rowName });
        }
      }

      let keepCard: { card: Card; row: CardRow } | null = null;
      if (player.faction === 'grey_rangers' && allFieldCards.length > 0) {
        // Only keep own cards, not enemy spies
        const ownCards = allFieldCards.filter(c => c.card.faction === player.faction);
        if (ownCards.length > 0) {
          const idx = Math.floor(Math.random() * ownCards.length);
          keepCard = ownCards[idx];
          s.log.push(`Grey Rangers perk: "${keepCard.card.name}" stays on field`);
        }
      }

      for (const rowName of ['melee', 'ranged', 'siege'] as CardRow[]) {
        for (const card of player.field[rowName]) {
          if (keepCard && card.id === keepCard.card.id) continue;
          // Сбросить strengthModifier/locked/owner при уходе в discard
          const discardCopy = { ...card };
          delete discardCopy.strengthModifier;
          delete discardCopy.locked;
          delete discardCopy.owner;
          player.discard.push(discardCopy);
        }
        player.field[rowName] = [];
      }

      if (keepCard) {
        // Сбросить modifier/locked и у оставшейся карты
        const kept = { ...keepCard.card };
        delete kept.strengthModifier;
        delete kept.locked;
        player.field[keepCard.row].push(kept);
      }

      player.hornActive = { melee: false, ranged: false, siege: false };
    }

    return s;
  }

  getVisibleState(state: GameState, forPlayerIndex: number): object {
    const opponentIndex = forPlayerIndex === 0 ? 1 : 0;
    const me = state.players[forPlayerIndex];
    const opp = state.players[opponentIndex];
    const myFaction = factions[me.faction];
    const oppFaction = factions[opp.faction];

    const canActivateLeader =
      state.phase === 'playing' &&
      state.currentPlayerIndex === forPlayerIndex &&
      !me.leaderUsed &&
      !me.passed;

    return {
      id: state.id,
      phase: state.phase,
      round: state.round,
      currentPlayerIndex: state.currentPlayerIndex,
      weather: { ...state.weather },
      partisansPending: state.partisansPending,
      myIndex: forPlayerIndex,
      me: {
        id: me.id,
        faction: me.faction,
        hand: [...me.hand],
        deck: { count: me.deck.length },
        discard: [...me.discard],
        passed: me.passed,
        roundsWon: me.roundsWon,
        field: me.field,
        hornActive: me.hornActive,
        leaderUsed: me.leaderUsed,
        leaderAbility: myFaction.leader.ability,
        canActivateLeader,
      },
      opponent: {
        faction: opp.faction,
        field: opp.field,
        hornActive: opp.hornActive,
        passed: opp.passed,
        roundsWon: opp.roundsWon,
        hand: { count: opp.hand.length },
        deck: { count: opp.deck.length },
        discard: [...opp.discard],
        leaderUsed: opp.leaderUsed,
        leaderAbility: oppFaction.leader.ability,
      },
      myStrength: {
        melee: this.calculateRowStrength(me.field.melee, state.weather.frost, me.hornActive.melee),
        ranged: this.calculateRowStrength(me.field.ranged, state.weather.fog, me.hornActive.ranged),
        siege: this.calculateRowStrength(me.field.siege, state.weather.rain, me.hornActive.siege),
        total: this.calculatePlayerStrength(me, state.weather),
      },
      opponentStrength: {
        melee: this.calculateRowStrength(opp.field.melee, state.weather.frost, opp.hornActive.melee),
        ranged: this.calculateRowStrength(opp.field.ranged, state.weather.fog, opp.hornActive.ranged),
        siege: this.calculateRowStrength(opp.field.siege, state.weather.rain, opp.hornActive.siege),
        total: this.calculatePlayerStrength(opp, state.weather),
      },
      log: state.log.slice(-20),
    };
  }

  private hasPartisansPlayer(state: GameState): boolean {
    return state.players.some(p => p.faction === 'litlad_partisans');
  }

  getPartisansPlayerIndex(state: GameState): number {
    return state.players.findIndex(p => p.faction === 'litlad_partisans');
  }

  private advanceTurn(state: GameState): void {
    const next = state.currentPlayerIndex === 0 ? 1 : 0;
    if (!state.players[next].passed) {
      state.currentPlayerIndex = next as 0 | 1;
    }
    // Auto-pass: if current player has no cards and leader already used
    this.checkAutoPass(state);
  }

  private checkAutoPass(state: GameState): void {
    if (state.phase !== 'playing') return;
    const current = state.players[state.currentPlayerIndex];
    if (current.hand.length === 0 && current.leaderUsed && !current.passed) {
      current.passed = true;
      state.log.push(`Player ${state.currentPlayerIndex} auto-passed (no cards, leader used)`);
      // If opponent also passed, don't switch turn — resolveRound will handle it
      const opponentIdx = state.currentPlayerIndex === 0 ? 1 : 0;
      if (!state.players[opponentIdx].passed) {
        state.currentPlayerIndex = opponentIdx as 0 | 1;
      }
    }
  }

  getWinner(state: GameState): number | null {
    if (state.phase !== 'game_over') return null;
    if (state.players[0].roundsWon > state.players[1].roundsWon) return 0;
    if (state.players[1].roundsWon > state.players[0].roundsWon) return 1;
    return null;
  }

  getFinalScore(state: GameState): [number, number] {
    return [state.players[0].roundsWon, state.players[1].roundsWon];
  }
}
