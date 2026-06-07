// --- Карты ---
export type CardRow = 'melee' | 'ranged' | 'siege';

export type CardAbility =
  | 'spy'
  | 'bond'
  | 'morale'
  | 'medic'
  | 'decoy'
  | 'frost'
  | 'fog'
  | 'rain'
  | 'clear'
  | 'horn'
  | 'scorch'
  | 'muster'
  | 'drain'
  | 'lock'
  | 'none';

export type CardType = 'unit' | 'special' | 'weather';

export interface Card {
  id: string;
  name: string;
  faction: FactionId;
  type: CardType;
  row?: CardRow;
  strength: number;
  ability: CardAbility;
  flexibleRow?: boolean;
  strengthModifier?: number;
  /**
   * Индекс игрока, которому принадлежит карта.
   * Заполняется только для шпионов, лежащих на чужой стороне поля.
   * Используется чтобы Decoy не мог забрать вражеского шпиона.
   */
  owner?: 0 | 1;
  /**
   * Заблокирована ли способность карты (lock).
   * Locked-карта остаётся на поле, её базовая сила не меняется,
   * но bond/morale/spy и т.п. эффекты игнорируются.
   */
  locked?: boolean;
}

// --- Фракции ---
export type FactionId = 'lion_guard' | 'imperial_dogs' | 'litlad_partisans' | 'grey_rangers' | 'vexitar_witches';

export type LeaderAbilityId =
  | 'rally_the_guard'
  | 'imperial_informant'
  | 'roots_of_tungrad'
  | 'blood_ritual'
  | 'witches_curse';

export interface FactionLeader {
  id: string;
  name: string;
  faction: FactionId;
  ability: string;
  abilityId: LeaderAbilityId;
}

export interface Faction {
  id: FactionId;
  name: string;
  leader: FactionLeader;
  deck: Card[];
  passiveDescription: string;
}

// --- Игровое состояние ---
export interface PlayerField {
  melee: Card[];
  ranged: Card[];
  siege: Card[];
}

export interface HornState {
  melee: boolean;
  ranged: boolean;
  siege: boolean;
}

export interface PlayerState {
  id: string;
  faction: FactionId;
  hand: Card[];
  deck: Card[];
  discard: Card[];
  passed: boolean;
  roundsWon: number;
  field: PlayerField;
  hornActive: HornState;
  leaderUsed: boolean;
}

export interface WeatherEffects {
  frost: boolean;
  fog: boolean;
  rain: boolean;
}

export type GamePhase =
  | 'waiting'
  | 'faction_select'
  | 'redraw'
  | 'playing'
  | 'partisans_choice'
  | 'round_end'
  | 'game_over';

export interface GameState {
  id: string;
  phase: GamePhase;
  players: PlayerState[];
  currentPlayerIndex: 0 | 1;
  round: 1 | 2 | 3;
  weather: WeatherEffects;
  log: string[];
  redrawsDone: number[];
  partisansPending?: boolean;
  lastRoundLoser?: number | null;
  pendingAction?: 'informant_choice' | 'roots_move' | null;
  pendingActionPlayer?: number;
  informantRevealed?: Card[];
}

// --- Эмоции ---
export type EmoteId = 'greet' | 'praise' | 'taunt' | 'thanks' | 'threat' | 'hurry';

export interface EmoteEvent {
  playerIndex: 0 | 1;
  emoteId: EmoteId;
  faction: FactionId;
}

export const VALID_EMOTE_IDS: readonly EmoteId[] = ['greet', 'praise', 'taunt', 'thanks', 'threat', 'hurry'];

// --- Комнаты ---
export interface Room {
  code: string;
  gameState: GameState;
  createdAt: number;
  playerSockets: string[];
  spectatorSockets: string[];
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  openHands: boolean;
  lastEmote?: { [playerIndex: number]: number };
}

// --- Наблюдатель ---
export interface SpectatorPlayerView {
  faction: FactionId;
  handCount: number;
  hand?: Card[];
  deckCount: number;
  discard: Card[];
  passed: boolean;
  roundsWon: number;
  leaderUsed: boolean;
  leaderAbility: string;
  field: PlayerField;
  hornActive: HornState;
}

export interface SpectatorGameState {
  id: string;
  phase: string;
  currentPlayerIndex: 0 | 1;
  round: number;
  weather: WeatherEffects;
  player1: SpectatorPlayerView;
  player2: SpectatorPlayerView;
  strength: {
    player1: { melee: number; ranged: number; siege: number; total: number };
    player2: { melee: number; ranged: number; siege: number; total: number };
  };
  log: string[];
  isSpectator: true;
}

// --- Socket events ---
export interface ServerToClientEvents {
  room_created: (data: { code: string }) => void;
  player_joined: (data: Record<string, never>) => void;
  faction_selected: (data: { playerIndex: number; faction: FactionId }) => void;
  game_started: (data: { state: unknown }) => void;
  state_update: (data: { state: unknown }) => void;
  medic_prompt: (data: { cards: Card[] }) => void;
  partisans_prompt: (data: Record<string, never>) => void;
  leader_activated: (data: { playerIndex: number; abilityId: LeaderAbilityId }) => void;
  informant_reveal: (data: { cards: Card[] }) => void;
  roots_prompt: (data: Record<string, never>) => void;
  round_result: (data: { winner: number | null; scores: [number, number] }) => void;
  game_over: (data: { winner: number | null; finalScore: [number, number] }) => void;
  opponent_disconnected: (data: Record<string, never>) => void;
  error: (data: { message: string }) => void;
  room_full: (data: { code: string }) => void;
  spectator_joined: (data: { state: SpectatorGameState }) => void;
  spectator_count: (data: { count: number }) => void;
  player_disconnected: (data: { playerIndex: number }) => void;
  player_reconnected: (data: { playerIndex: number }) => void;
  emote: (data: EmoteEvent) => void;
}

export interface ClientToServerEvents {
  create_room: (data?: { openHands?: boolean }) => void;
  join_room: (data: { code: string }) => void;
  join_as_spectator: (data: { code: string }) => void;
  select_faction: (data: { faction: FactionId }) => void;
  redraw_cards: (data: { cardIds: string[] }) => void;
  play_card: (data: { cardId: string; targetRow?: CardRow }) => void;
  medic_choice: (data: { cardId: string | null }) => void;
  pass: () => void;
  partisans_first: (data: { goFirst: boolean }) => void;
  activate_leader: (data: { targetRow?: CardRow }) => void;
  informant_choice: (data: { cardId: string }) => void;
  roots_move: (data: { moves: { cardId: string; toRow: CardRow }[] }) => void;
  reconnect: (data: { code: string }) => void;
  send_emote: (data: { emoteId: EmoteId }) => void;
}
