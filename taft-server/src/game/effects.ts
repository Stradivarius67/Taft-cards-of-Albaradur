import { Card, CardRow, GameState, PlayerState } from '../types.js';

/**
 * Deep clone GameState (без Map/Set — они не используются в GameState)
 */
function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

/**
 * Spy: карта ложится на поле ПРОТИВНИКА, текущий игрок тянет 2 карты.
 * Возвращает новый GameState (иммутабельно).
 */
export function applySpy(
  state: GameState,
  playerIndex: number,
  card: Card
): GameState {
  const s = cloneState(state);
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const opponent = s.players[opponentIndex];
  const player = s.players[playerIndex];
  const row = card.row!;

  // Помечаем шпиона как принадлежащего тому, кто его сыграл,
  // чтобы Decoy противника не смог его забрать.
  opponent.field[row].push({ ...card, owner: playerIndex as 0 | 1 });

  // Тянем до 2 карт из колоды
  for (let i = 0; i < 2; i++) {
    if (player.deck.length > 0) {
      player.hand.push(player.deck.pop()!);
    }
  }

  s.log.push(`Player ${playerIndex} played spy "${card.name}" — opponent gets the card, player draws 2`);
  return s;
}

/**
 * Medic: ставит карту-медика в свой ряд и возвращает список unit-карт из сброса для выбора.
 * Возвращает { state, pendingChoice }.
 */
export function applyMedic(
  state: GameState,
  playerIndex: number,
  card: Card
): { state: GameState; pendingChoice: Card[] } {
  const s = cloneState(state);
  const player = s.players[playerIndex];
  const row = card.row || 'melee';

  // Медик ставится на поле
  player.field[row].push({ ...card });
  s.log.push(`Player ${playerIndex} played medic "${card.name}" to ${row}`);

  // Список unit-карт в сбросе
  const pendingChoice = player.discard.filter(c => c.type === 'unit');

  return { state: s, pendingChoice };
}

/**
 * MedicChoice: перемещает выбранную карту из сброса на поле.
 * Ability выбранной карты НЕ срабатывает (чтобы избежать бесконечных цепочек).
 */
export function applyMedicChoice(
  state: GameState,
  playerIndex: number,
  cardId: string | null
): GameState {
  if (!cardId) return state;

  const s = cloneState(state);
  const player = s.players[playerIndex];
  const idx = player.discard.findIndex(c => c.id === cardId);
  if (idx === -1) return s;

  const [card] = player.discard.splice(idx, 1);
  const row = card.row || 'melee';
  player.field[row].push(card);
  s.log.push(`Player ${playerIndex} used medic to revive "${card.name}" to ${row}`);

  return s;
}

/**
 * Decoy: забирает unit-карту с поля обратно в руку. Приманка уходит в сброс.
 * Валидация: целевая карта должна быть unit.
 */
export function applyDecoy(
  state: GameState,
  playerIndex: number,
  targetCardId: string,
  decoyCard: Card
): { state: GameState; error?: string } {
  const s = cloneState(state);
  const player = s.players[playerIndex];

  for (const rowName of ['melee', 'ranged', 'siege'] as CardRow[]) {
    const row = player.field[rowName];
    const idx = row.findIndex(c => c.id === targetCardId);
    if (idx !== -1) {
      const targetCard = row[idx];

      // Валидация: нельзя забрать non-unit
      if (targetCard.type !== 'unit') {
        return { state, error: 'Приманка работает только на юнитов' };
      }

      // Валидация: нельзя забрать вражескую карту (шпиона противника).
      // owner заполняется при розыгрыше шпиона. Если он не задан — карта своя.
      if (targetCard.owner !== undefined && targetCard.owner !== playerIndex) {
        return { state, error: 'Нельзя забрать карту противника' };
      }

      // Доп. проверка через faction (на случай если по какой-то причине
      // карта оказалась на нашем поле без owner).
      if (targetCard.owner === undefined && targetCard.faction !== player.faction) {
        return { state, error: 'Нельзя забрать карту противника' };
      }

      const [extracted] = row.splice(idx, 1);
      // Сбросить owner и strengthModifier при возврате в руку
      const cleaned: Card = { ...extracted };
      delete cleaned.owner;
      delete cleaned.strengthModifier;
      player.hand.push(cleaned);
      player.discard.push({ ...decoyCard });
      s.log.push(`Player ${playerIndex} used decoy to retrieve "${targetCard.name}"`);
      return { state: s };
    }
  }

  return { state, error: 'Карта не найдена на вашем поле' };
}

/**
 * Weather: включает frost/fog/rain
 */
export function applyWeather(
  state: GameState,
  weatherType: 'frost' | 'fog' | 'rain',
  weatherCard: Card,
  playerIndex: number
): GameState {
  const s = cloneState(state);
  s.weather[weatherType] = true;
  s.players[playerIndex].discard.push({ ...weatherCard });
  s.log.push(`Weather effect "${weatherType}" applied`);
  return s;
}

/**
 * Clear: убрать все погодные эффекты
 */
export function applyClear(state: GameState, clearCard: Card, playerIndex: number): GameState {
  const s = cloneState(state);
  s.weather.frost = false;
  s.weather.fog = false;
  s.weather.rain = false;
  s.players[playerIndex].discard.push({ ...clearCard });
  s.log.push('All weather effects cleared');
  return s;
}

/**
 * Horn: активирует horn на выбранном ряду.
 * Карта horn уходит в discard.
 */
export function applyHorn(
  state: GameState,
  playerIndex: number,
  targetRow: CardRow,
  hornCard: Card
): { state: GameState; error?: string } {
  const s = cloneState(state);
  const player = s.players[playerIndex];

  if (player.hornActive[targetRow]) {
    return { state, error: 'Рожок уже активирован на этом ряду' };
  }

  player.hornActive[targetRow] = true;
  player.discard.push({ ...hornCard });
  s.log.push(`Player ${playerIndex} activated horn on ${targetRow}`);
  return { state: s };
}

const ROW_NAMES: readonly CardRow[] = ['melee', 'ranged', 'siege'];

/**
 * Scorch (Испепеление): уничтожает все unit-карты с максимальной эффективной силой
 * на поле обоих игроков. Обоюдоостро — может сжечь и свою сильнейшую карту.
 * Сама карта-scorch (special) уходит в discard игрока, который её сыграл.
 */
export function applyScorch(
  state: GameState,
  playerIndex: number,
  scorchCard: Card
): GameState {
  const s = cloneState(state);

  let maxStrength = 0;
  for (const player of s.players) {
    for (const row of ROW_NAMES) {
      for (const card of player.field[row]) {
        if (card.type !== 'unit') continue;
        const eff = card.strength + (card.strengthModifier ?? 0);
        if (eff > maxStrength) maxStrength = eff;
      }
    }
  }

  // Сама карта scorch (special) уходит в сброс игрока, который её разыграл.
  s.players[playerIndex].discard.push({ ...scorchCard });

  if (maxStrength <= 0) {
    s.log.push(`Player ${playerIndex} played scorch — на поле нет целей`);
    return s;
  }

  let burned = 0;
  for (const player of s.players) {
    for (const row of ROW_NAMES) {
      const keep: Card[] = [];
      for (const card of player.field[row]) {
        if (card.type === 'unit') {
          const eff = card.strength + (card.strengthModifier ?? 0);
          if (eff === maxStrength) {
            const discardCopy = { ...card };
            delete discardCopy.strengthModifier;
            delete discardCopy.locked;
            delete discardCopy.owner;
            player.discard.push(discardCopy);
            burned += 1;
            continue;
          }
        }
        keep.push(card);
      }
      player.field[row] = keep;
    }
  }

  s.log.push(
    `Player ${playerIndex} played scorch — уничтожено ${burned} карт силой ${maxStrength}`
  );
  return s;
}

/**
 * Muster (Сбор): когда играется карта с muster — все одноимённые карты
 * текущего игрока автоматически достаются из колоды и ставятся на то же поле.
 * Сама стартовая карта тоже ставится на поле.
 */
export function applyMuster(
  state: GameState,
  playerIndex: number,
  card: Card,
  targetRow?: CardRow
): GameState {
  const s = cloneState(state);
  const player = s.players[playerIndex];
  const baseRow: CardRow = card.flexibleRow && targetRow
    ? targetRow
    : (card.row ?? targetRow ?? 'melee');

  // Сначала сама карта на поле.
  player.field[baseRow].push({ ...card });
  let summoned = 0;

  // Все одноимённые из колоды — туда же.
  const newDeck: Card[] = [];
  for (const c of player.deck) {
    if (c.name === card.name) {
      const placeRow: CardRow = c.flexibleRow && targetRow
        ? targetRow
        : (c.row ?? baseRow);
      player.field[placeRow].push({ ...c });
      summoned += 1;
    } else {
      newDeck.push(c);
    }
  }
  player.deck = newDeck;

  s.log.push(
    `Player ${playerIndex} muster "${card.name}" — призвано ещё ${summoned} карт из колоды`
  );
  return s;
}

/**
 * Drain (Вытягивание силы): карта отнимает 2 силы у случайной unit-карты
 * противника в том же ряду и забирает их себе. Если у цели сила падает до 0
 * или ниже — она уничтожается. Если в ряду противника нет юнитов — drain
 * просто кладётся на поле без эффекта.
 */
export function applyDrain(
  state: GameState,
  playerIndex: number,
  card: Card,
  targetRow?: CardRow
): GameState {
  const s = cloneState(state);
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const opponent = s.players[opponentIndex];
  const player = s.players[playerIndex];
  const row: CardRow = card.flexibleRow && targetRow
    ? targetRow
    : (card.row ?? targetRow ?? 'melee');

  const placedCard: Card = { ...card };
  player.field[row].push(placedCard);

  // Цель — только живые юниты противника в этом же ряду.
  const targets = opponent.field[row].filter(c => c.type === 'unit');
  if (targets.length === 0) {
    s.log.push(`Player ${playerIndex} drain "${card.name}" — нет целей в ряду ${row}`);
    return s;
  }

  const target = targets[Math.floor(Math.random() * targets.length)];
  const before = target.strength + (target.strengthModifier ?? 0);
  const drainAmount = Math.min(2, Math.max(0, before));
  target.strengthModifier = (target.strengthModifier ?? 0) - drainAmount;
  placedCard.strengthModifier = (placedCard.strengthModifier ?? 0) + drainAmount;

  const after = target.strength + (target.strengthModifier ?? 0);
  if (after <= 0) {
    opponent.field[row] = opponent.field[row].filter(c => c.id !== target.id);
    const discardCopy = { ...target };
    delete discardCopy.strengthModifier;
    delete discardCopy.locked;
    delete discardCopy.owner;
    opponent.discard.push(discardCopy);
    s.log.push(
      `Player ${playerIndex} drain "${card.name}" — высушил "${target.name}" насмерть`
    );
  } else {
    s.log.push(
      `Player ${playerIndex} drain "${card.name}" — вытянул ${drainAmount} силы у "${target.name}"`
    );
  }
  return s;
}

/**
 * Lock (Блокировка): карта-замочник ставится на своё поле, и одна выбранная
 * карта-юнит на поле противника помечается locked=true. Заблокированные карты
 * остаются на поле, но их bond/morale/spy/etc. эффекты игнорируются.
 *
 * targetCardId должен указывать на карту в `opponent.field[*]`.
 */
export function applyLock(
  state: GameState,
  playerIndex: number,
  card: Card,
  targetCardId: string,
  targetRow?: CardRow
): { state: GameState; error?: string } {
  const s = cloneState(state);
  const player = s.players[playerIndex];
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const opponent = s.players[opponentIndex];

  let found: Card | null = null;
  for (const row of ROW_NAMES) {
    const target = opponent.field[row].find(c => c.id === targetCardId);
    if (target) {
      if (target.type !== 'unit') {
        return { state, error: 'Блокировать можно только юнитов' };
      }
      target.locked = true;
      found = target;
      break;
    }
  }

  if (!found) {
    return { state, error: 'Цель для блокировки не найдена' };
  }

  // Сама карта lock — это юнит, ставится на своё поле.
  const placeRow: CardRow = card.flexibleRow && targetRow
    ? targetRow
    : (card.row ?? 'melee');
  player.field[placeRow].push({ ...card });

  s.log.push(`Player ${playerIndex} lock "${card.name}" — заблокирована "${found.name}"`);
  return { state: s };
}
