export type CardRow = 'melee' | 'ranged' | 'siege';
export type CardAbility =
  | 'spy' | 'bond' | 'morale' | 'medic' | 'decoy'
  | 'frost' | 'fog' | 'rain' | 'clear' | 'horn'
  | 'scorch' | 'muster' | 'drain' | 'lock'
  | 'none';
export type CardType = 'unit' | 'special' | 'weather';
export type { ArenaMutator } from '../data/mutators';
export type FactionId = 'lion_guard' | 'imperial_dogs' | 'litlad_partisans' | 'grey_rangers' | 'vexitar_witches';
export type LeaderAbilityId =
  | 'rally_the_guard'
  | 'imperial_informant'
  | 'roots_of_tungrad'
  | 'blood_ritual'
  | 'witches_curse';

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
  /** Индекс игрока-владельца (только для шпионов на чужом поле). */
  owner?: 0 | 1;
  /** Заблокирована ли способность карты (lock-эффект). */
  locked?: boolean;
}

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

export interface WeatherEffects {
  frost: boolean;
  fog: boolean;
  rain: boolean;
}

export interface StrengthInfo {
  melee: number;
  ranged: number;
  siege: number;
  total: number;
}

export interface MyPlayerState {
  id: string;
  faction: FactionId;
  hand: Card[];
  deck: { count: number };
  discard: Card[];
  passed: boolean;
  roundsWon: number;
  field: PlayerField;
  hornActive: HornState;
  leaderUsed: boolean;
  leaderAbility: string;
  canActivateLeader: boolean;
}

export interface OpponentState {
  faction: FactionId;
  hand: { count: number };
  deck: { count: number };
  discard: Card[];
  passed: boolean;
  roundsWon: number;
  field: PlayerField;
  hornActive: HornState;
  leaderUsed: boolean;
  leaderAbility: string;
}

export interface VisibleGameState {
  id: string;
  phase: string;
  currentPlayerIndex: 0 | 1;
  round: number;
  weather: WeatherEffects;
  mutator?: import('../data/mutators').ArenaMutator;
  partisansPending?: boolean;
  myIndex: 0 | 1;
  me: MyPlayerState;
  opponent: OpponentState;
  myStrength?: StrengthInfo;
  opponentStrength?: StrengthInfo;
  log: string[];
}

// --- Spectator types ---
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
  mutator?: import('../data/mutators').ArenaMutator;
  player1: SpectatorPlayerView;
  player2: SpectatorPlayerView;
  strength: {
    player1: StrengthInfo;
    player2: StrengthInfo;
  };
  log: string[];
  isSpectator: true;
}

export const FACTION_NAMES: Record<FactionId, string> = {
  lion_guard: 'Львиная гвардия',
  imperial_dogs: 'Имперские псы',
  litlad_partisans: 'Литладские партизаны',
  grey_rangers: 'Серые следопыты',
  vexitar_witches: 'Векситарские ведьмы',
};

export const FACTION_COLORS: Record<FactionId, string> = {
  lion_guard: '#D4A843',
  imperial_dogs: '#C0392B',
  litlad_partisans: '#27AE60',
  grey_rangers: '#7F8C8D',
  vexitar_witches: '#6C3483',
};

export const ROW_LABELS: Record<CardRow, string> = {
  melee: 'Ближний бой',
  ranged: 'Дальний бой',
  siege: 'Осада',
};

export const ABILITY_LABELS: Record<CardAbility, string> = {
  spy: 'Шпион',
  bond: 'Связь',
  morale: 'Боевой дух',
  medic: 'Медик',
  decoy: 'Приманка',
  frost: 'Мороз',
  fog: 'Туман',
  rain: 'Дождь',
  clear: 'Рассвет',
  horn: 'Рожок',
  scorch: 'Испепеление',
  muster: 'Сбор',
  drain: 'Вытягивание',
  lock: 'Блокировка',
  none: '',
};
