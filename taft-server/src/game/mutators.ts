// ===========================================================================
// Мутаторы арены («Недельные правила»)
// ===========================================================================
// Глобальное правило, действующее на весь матч. Хост выбирает мутатор при
// создании комнаты; по умолчанию предлагается «мутатор недели» (детерминированно
// ротируется по номеру недели — обновление меты без нового контента).
//
// ВАЖНО: это источник правды по поведению мутаторов. Клиентский реестр
// (taft-client/src/data/mutators.ts) — лишь зеркало для отображения пикера и
// должен совпадать по id/названиям.

export type ArenaMutator = 'none' | 'reinforcements' | 'grand_arsenal' | 'still_air';

export interface MutatorInfo {
  id: ArenaMutator;
  name: string;
  description: string;
}

/** Реестр всех мутаторов. Порядок важен для пикера в лобби. */
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

/** Мутаторы, участвующие в недельной ротации (без `none` — это опт-аут). */
export const WEEKLY_ROTATION: ArenaMutator[] = ['reinforcements', 'grand_arsenal', 'still_air'];

const STARTING_HAND_DEFAULT = 10;
const STARTING_HAND_GRAND_ARSENAL = 11;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Проверяет, что значение — валидный id мутатора. */
export function isValidMutator(value: unknown): value is ArenaMutator {
  return typeof value === 'string' && value in MUTATORS;
}

/** Нормализует произвольный ввод к валидному мутатору (иначе `none`). */
export function normalizeMutator(value: unknown): ArenaMutator {
  return isValidMutator(value) ? value : 'none';
}

/**
 * Детерминированный «мутатор недели». Зависит только от даты, поэтому
 * одинаков для всех матчей в течение недели и предсказуемо ротируется.
 */
export function getWeeklyMutator(date: Date = new Date()): ArenaMutator {
  const weekIndex = Math.floor(date.getTime() / WEEK_MS);
  const idx = ((weekIndex % WEEKLY_ROTATION.length) + WEEKLY_ROTATION.length) % WEEKLY_ROTATION.length;
  return WEEKLY_ROTATION[idx];
}

/** Размер стартовой руки с учётом мутатора. */
export function getStartingHandSize(mutator: ArenaMutator): number {
  return mutator === 'grand_arsenal' ? STARTING_HAND_GRAND_ARSENAL : STARTING_HAND_DEFAULT;
}

/** Действует ли рожок при данном мутаторе (Безветрие отключает удвоение). */
export function hornEnabled(mutator: ArenaMutator): boolean {
  return mutator !== 'still_air';
}

/** Бонус к силе одного юнита от мутатора (Подкрепления: +1). */
export function unitStrengthBonus(mutator: ArenaMutator): number {
  return mutator === 'reinforcements' ? 1 : 0;
}
