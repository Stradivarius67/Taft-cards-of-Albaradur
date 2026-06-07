import type { FactionId } from '../types/game';

export type EmoteId = 'greet' | 'praise' | 'taunt' | 'thanks' | 'threat' | 'hurry';

export interface EmoteDefinition {
  id: EmoteId;
  label: string;
  icon: string;
}

export const EMOTES: EmoteDefinition[] = [
  { id: 'greet',  label: 'Приветствие', icon: '⚔' },
  { id: 'praise', label: 'Похвала',    icon: '★' },
  { id: 'taunt',  label: 'Насмешка',   icon: '♠' },
  { id: 'thanks', label: 'Спасибо',    icon: '♦' },
  { id: 'threat', label: 'Угроза',     icon: '☠' },
  { id: 'hurry',  label: 'Торопить',   icon: '⏳' },
];

export const LEADER_NAMES: Record<FactionId, string> = {
  lion_guard: 'Хальгер',
  imperial_dogs: 'Торвус',
  litlad_partisans: 'Жизнедерево',
  grey_rangers: 'Первый Следопыт',
  vexitar_witches: 'Гризельда',
};

export const EMOTE_LINES: Record<FactionId, Record<EmoteId, string>> = {
  lion_guard: {
    greet:  'За Конгломерат и Короля!',
    praise: 'Достойный манёвр, воин.',
    taunt:  'Твоя гвардия разбежалась?',
    thanks: 'Честь сражаться с вами.',
    threat: 'Львы не знают пощады!',
    hurry:  'Ваш ход, стратег.',
  },
  imperial_dogs: {
    greet:  'Империя не знает поражений.',
    praise: 'Ловко... для деревенщины.',
    taunt:  'Губернатор видел и крыс храбрее.',
    thanks: 'Империя ценит ваш... вклад.',
    threat: 'Колонии нуждаются в рабах.',
    hurry:  'Империя не ждёт.',
  },
  litlad_partisans: {
    greet:  'Корни помнят всех, кто приходил.',
    praise: 'Даже деревья склоняют ветви.',
    taunt:  'Одуванчиковое пиво крепче твоих карт.',
    thanks: 'Троебожие благословит эту битву.',
    threat: 'Не трогай наших богов.',
    hurry:  'Даже корни растут быстрее.',
  },
  grey_rangers: {
    greet:  'Кровь уже чует добычу.',
    praise: 'Зверь признаёт силу.',
    taunt:  'Даже гончие зевают.',
    thanks: 'Достойная охота.',
    threat: 'Ритуал начинается.',
    hurry:  'Кровь стынет.',
  },
  vexitar_witches: {
    greet:  'Добро пожаловать в мой лес, дитя.',
    praise: 'Даже ведьма признаёт мастерство.',
    taunt:  'Мои крысы играют лучше.',
    thanks: 'Пакт скреплён. До следующей встречи.',
    threat: 'Гризельда уже варит зелье для тебя.',
    hurry:  'Луна не будет ждать вечно.',
  },
};
