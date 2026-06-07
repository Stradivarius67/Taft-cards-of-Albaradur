// Зеркало серверного реестра мутаторов (taft-server/src/game/mutators.ts).
// Используется для пикера в лобби и подписей в UI. Источник правды по
// ПОВЕДЕНИЮ — сервер; здесь только id/названия/описания и недельная ротация
// для дефолтного выбора. Держать в синхроне с сервером.

export type ArenaMutator = 'none' | 'reinforcements' | 'grand_arsenal' | 'still_air';

export interface MutatorInfo {
  id: ArenaMutator;
  name: string;
  description: string;
}

export const MUTATORS: Record<ArenaMutator, MutatorInfo> = {
  none: {
    id: 'none',
    name: 'Обычные правила',
    description: 'Стандартный матч без модификаторов.',
  },
  reinforcements: {
    id: 'reinforcements',
    name: 'Подкрепления',
    description: 'Каждый юнит на поле получает +1 к силе (применяется после погоды).',
  },
  grand_arsenal: {
    id: 'grand_arsenal',
    name: 'Большой арсенал',
    description: 'Стартовая рука — 11 карт вместо 10.',
  },
  still_air: {
    id: 'still_air',
    name: 'Безветрие',
    description: 'Боевой рожок больше не удваивает силу ряда.',
  },
};

/** Порядок мутаторов в пикере лобби. */
export const MUTATOR_ORDER: ArenaMutator[] = ['none', 'reinforcements', 'grand_arsenal', 'still_air'];

/** Мутаторы недельной ротации (без `none`). Совпадает с сервером. */
export const WEEKLY_ROTATION: ArenaMutator[] = ['reinforcements', 'grand_arsenal', 'still_air'];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Детерминированный «мутатор недели» — должен совпадать с серверным. */
export function getWeeklyMutator(date: Date = new Date()): ArenaMutator {
  const weekIndex = Math.floor(date.getTime() / WEEK_MS);
  const len = WEEKLY_ROTATION.length;
  return WEEKLY_ROTATION[((weekIndex % len) + len) % len];
}
