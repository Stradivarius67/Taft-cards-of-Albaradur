import { Card, Faction, FactionId } from '../types.js';

function makeCards(faction: FactionId, cards: Omit<Card, 'faction'>[]): Card[] {
  return cards.map(c => ({ ...c, faction }));
}

// =============================================================================
// ЛЬВИНАЯ ГВАРДИЯ (lion_guard)
// Конгломерат Астальдис — мушкетёры Короля-льва Хальгера Бротена
// Пассивка: при выигрыше раунда тянет 1 карту из колоды
// Стиль: синергия через bond и morale
// =============================================================================
const lionGuardDeck: Card[] = makeCards('lion_guard', [
  { id: 'lg_musketeer_1', name: 'Львиный мушкетёр', type: 'unit', row: 'melee', strength: 5, ability: 'bond' },
  { id: 'lg_musketeer_2', name: 'Львиный мушкетёр', type: 'unit', row: 'melee', strength: 5, ability: 'bond' },
  { id: 'lg_musketeer_3', name: 'Львиный мушкетёр', type: 'unit', row: 'melee', strength: 5, ability: 'bond' },
  { id: 'lg_knight', name: 'Рыцарь Варии', type: 'unit', row: 'melee', strength: 6, ability: 'none' },
  { id: 'lg_militia', name: 'Горийский ополченец', type: 'unit', row: 'melee', strength: 4, ability: 'none' },
  { id: 'lg_tribune', name: 'Трибун народа', type: 'unit', row: 'melee', strength: 3, ability: 'morale' },
  { id: 'lg_shooter', name: 'Стрелок Конгломерата', type: 'unit', row: 'ranged', strength: 5, ability: 'none' },
  { id: 'lg_cannoneer_1', name: 'Рунный канонир', type: 'unit', row: 'ranged', strength: 4, ability: 'bond' },
  { id: 'lg_cannoneer_2', name: 'Рунный канонир', type: 'unit', row: 'ranged', strength: 4, ability: 'bond' },
  { id: 'lg_spy', name: 'Варийский шпион', type: 'unit', row: 'ranged', strength: 5, ability: 'spy' },
  { id: 'lg_halfling', name: 'Полурослик-разведчик', type: 'unit', row: 'ranged', strength: 2, ability: 'none' },
  { id: 'lg_ballista', name: 'Паровая баллиста', type: 'unit', row: 'siege', strength: 6, ability: 'none' },
  { id: 'lg_golem', name: 'Осадный голем Астальдиса', type: 'unit', row: 'siege', strength: 7, ability: 'none' },
  { id: 'lg_engineer', name: 'Фабричный инженер', type: 'unit', row: 'siege', strength: 3, ability: 'none' },
  { id: 'lg_bombardier', name: 'Горийский бомбардир', type: 'unit', row: 'siege', strength: 4, ability: 'none' },
  { id: 'lg_horn', name: 'Зачарованный рожок', type: 'special', strength: 0, ability: 'horn' },
  { id: 'lg_medic', name: 'Полевой лекарь', type: 'unit', row: 'melee', strength: 1, ability: 'medic' },
  { id: 'lg_decoy', name: 'Обманный манёвр', type: 'special', strength: 0, ability: 'decoy' },
  { id: 'lg_scout', name: 'Горийский разведчик', type: 'unit', row: 'ranged', strength: 3, ability: 'none' },
  // Погода: 3 карты (заменяют двух Мечников Конгломерата)
  { id: 'lg_fog', name: 'Фабричный смог', type: 'weather', strength: 0, ability: 'fog' },
  { id: 'lg_frost', name: 'Горийская вьюга', type: 'weather', strength: 0, ability: 'frost' },
  { id: 'lg_clear', name: 'Ветер перемен', type: 'weather', strength: 0, ability: 'clear' },
]);

// =============================================================================
// ИМПЕРСКИЕ ПСЫ (imperial_dogs)
// Империя Иния — колониальные генералы, инквизиторы, шпионская сеть
// Пассивка: при ничьей в раунде побеждают Имперские псы
// Стиль: шпионы, контроль через scorch и lock
// =============================================================================
const imperialDogsDeck: Card[] = makeCards('imperial_dogs', [
  { id: 'id_legionary', name: 'Имперский легионер', type: 'unit', row: 'melee', strength: 5, ability: 'none' },
  { id: 'id_bravadores_1', name: 'Бравадорес', type: 'unit', row: 'melee', strength: 4, ability: 'bond' },
  { id: 'id_bravadores_2', name: 'Бравадорес', type: 'unit', row: 'melee', strength: 4, ability: 'bond' },
  { id: 'id_inquisitor', name: 'Инквизитор храмовников', type: 'unit', row: 'melee', strength: 6, ability: 'none' },
  { id: 'id_overseer', name: 'Надсмотрщик рудников', type: 'unit', row: 'melee', strength: 3, ability: 'morale' },
  { id: 'id_lock', name: 'Цепной маг', type: 'unit', row: 'melee', strength: 4, ability: 'lock' },
  { id: 'id_spy_1', name: 'Имперский шпион', type: 'unit', row: 'ranged', strength: 5, ability: 'spy' },
  { id: 'id_spy_2', name: 'Имперский шпион', type: 'unit', row: 'ranged', strength: 5, ability: 'spy' },
  { id: 'id_defector', name: 'Перебежчик-тифлинг', type: 'unit', row: 'ranged', strength: 7, ability: 'spy' },
  { id: 'id_colonial', name: 'Колониальный стрелок', type: 'unit', row: 'ranged', strength: 4, ability: 'none' },
  { id: 'id_mage', name: 'Маг круга', type: 'unit', row: 'ranged', strength: 3, ability: 'none' },
  { id: 'id_yacht', name: 'Воздушный ялик', type: 'unit', row: 'siege', strength: 6, ability: 'none' },
  { id: 'id_cannon', name: 'Осадная пушка «Торналез»', type: 'unit', row: 'siege', strength: 7, ability: 'none' },
  { id: 'id_mgash', name: 'Боевой орк «Мгаш»', type: 'unit', row: 'siege', strength: 5, ability: 'none' },
  { id: 'id_mortar', name: 'Пороховая мортира', type: 'unit', row: 'siege', strength: 4, ability: 'none' },
  { id: 'id_horn', name: 'Имперский рожок', type: 'special', strength: 0, ability: 'horn' },
  { id: 'id_medic', name: 'Полевой хирург', type: 'unit', row: 'melee', strength: 1, ability: 'medic' },
  { id: 'id_decoy', name: 'Двойной агент', type: 'special', strength: 0, ability: 'decoy' },
  { id: 'id_scorch', name: 'Имперский палач', type: 'special', strength: 0, ability: 'scorch' },
  // Погода: 3 карты (заменяют двух Имперских гвардейцев)
  { id: 'id_rain', name: 'Пороховой дым', type: 'weather', strength: 0, ability: 'rain' },
  { id: 'id_fog', name: 'Колониальный туман', type: 'weather', strength: 0, ability: 'fog' },
  { id: 'id_clear', name: 'Приказ Императора', type: 'weather', strength: 0, ability: 'clear' },
]);

// =============================================================================
// ЛИТЛАДСКИЕ ПАРТИЗАНЫ (litlad_partisans)
// Жители залива Литлад — фанатики трёх священных городов
// Пассивка: решает кто ходит первым в каждом раунде
// Стиль: гибкость + muster (партизаны выходят разом)
// =============================================================================
const litladPartisansDeck: Card[] = makeCards('litlad_partisans', [
  { id: 'lp_hellgate', name: 'Ополченец Хеллгейта', type: 'unit', strength: 4, ability: 'none', flexibleRow: true },
  { id: 'lp_eld', name: 'Эльд-охотник', type: 'unit', strength: 5, ability: 'none', flexibleRow: true },
  { id: 'lp_priestess', name: 'Жрица Боваса', type: 'unit', strength: 3, ability: 'morale', flexibleRow: true },
  { id: 'lp_zealot', name: 'Ревнитель Сангрейва', type: 'unit', row: 'melee', strength: 6, ability: 'none' },
  { id: 'lp_catran', name: 'Наездник на Катране', type: 'unit', strength: 5, ability: 'none', flexibleRow: true },
  { id: 'lp_smuggler', name: 'Контрабандист залива', type: 'unit', row: 'ranged', strength: 4, ability: 'spy' },
  { id: 'lp_autumn', name: 'Рыцарь Осени', type: 'unit', row: 'melee', strength: 7, ability: 'none' },
  { id: 'lp_berserker', name: 'Фирболг-берсерк', type: 'unit', strength: 6, ability: 'none', flexibleRow: true },
  { id: 'lp_druid_1', name: 'Друид плачущего леса', type: 'unit', strength: 4, ability: 'muster', flexibleRow: true },
  { id: 'lp_druid_2', name: 'Друид плачущего леса', type: 'unit', strength: 4, ability: 'muster', flexibleRow: true },
  { id: 'lp_partisan_1', name: 'Партизан Литлада', type: 'unit', strength: 3, ability: 'muster', flexibleRow: true },
  { id: 'lp_partisan_2', name: 'Партизан Литлада', type: 'unit', strength: 3, ability: 'muster', flexibleRow: true },
  { id: 'lp_partisan_3', name: 'Партизан Литлада', type: 'unit', strength: 3, ability: 'muster', flexibleRow: true },
  { id: 'lp_gatekeeper', name: 'Стражник Врат', type: 'unit', row: 'ranged', strength: 5, ability: 'none' },
  { id: 'lp_stoneshooter', name: 'Каменный стрелок', type: 'unit', row: 'siege', strength: 4, ability: 'none' },
  { id: 'lp_catapult', name: 'Катапульта Сангрейва', type: 'unit', row: 'siege', strength: 5, ability: 'none' },
  { id: 'lp_horn', name: 'Рог трёх городов', type: 'special', strength: 0, ability: 'horn' },
  { id: 'lp_medic', name: 'Травник-целитель', type: 'unit', strength: 1, ability: 'medic', flexibleRow: true },
  { id: 'lp_decoy', name: 'Подмена', type: 'special', strength: 0, ability: 'decoy' },
  // Погода: 3 карты (заменяют lp_fisher, lp_hunter, lp_bard, lp_alchemist, lp_weaver)
  { id: 'lp_frost', name: 'Ледяной ветер с гор', type: 'weather', strength: 0, ability: 'frost' },
  { id: 'lp_rain', name: 'Слёзы Игадриэля', type: 'weather', strength: 0, ability: 'rain' },
  { id: 'lp_clear', name: 'Благословение рощи', type: 'weather', strength: 0, ability: 'clear' },
]);

// =============================================================================
// СЕРЫЕ СЛЕДОПЫТЫ (grey_rangers)
// Охотники на чудовищ, практикующие магию крови
// Пассивка: 1 случайная карта остаётся на поле между раундами
// Стиль: грубая сила, drain (Кровопийца), минимум спецэффектов
// =============================================================================
const greyRangersDeck: Card[] = makeCards('grey_rangers', [
  { id: 'gr_swordsman', name: 'Следопыт-мечник', type: 'unit', row: 'melee', strength: 6, ability: 'none' },
  { id: 'gr_bloodhunter', name: 'Кровавый охотник', type: 'unit', row: 'melee', strength: 5, ability: 'none' },
  { id: 'gr_minotaur', name: 'Подчинённый минотавр', type: 'unit', row: 'melee', strength: 8, ability: 'none' },
  { id: 'gr_chaoslord', name: 'Ловчий хаоса', type: 'unit', row: 'melee', strength: 4, ability: 'morale' },
  { id: 'gr_leonid', name: 'Порабощённый леониец', type: 'unit', row: 'melee', strength: 7, ability: 'none' },
  { id: 'gr_drain', name: 'Кровопийца', type: 'unit', row: 'melee', strength: 4, ability: 'drain' },
  { id: 'gr_crossbow', name: 'Следопыт-арбалетчик', type: 'unit', row: 'ranged', strength: 5, ability: 'none' },
  { id: 'gr_catcher_1', name: 'Ловец тварей', type: 'unit', row: 'ranged', strength: 4, ability: 'bond' },
  { id: 'gr_catcher_2', name: 'Ловец тварей', type: 'unit', row: 'ranged', strength: 4, ability: 'bond' },
  { id: 'gr_wyvern', name: 'Подчинённый виверн', type: 'unit', row: 'ranged', strength: 8, ability: 'none' },
  { id: 'gr_bloodmage', name: 'Кровавый маг', type: 'unit', row: 'ranged', strength: 3, ability: 'spy' },
  { id: 'gr_tartar', name: 'Тварь из Тартара', type: 'unit', row: 'siege', strength: 9, ability: 'none' },
  { id: 'gr_dragon', name: 'Подчинённый дракон', type: 'unit', row: 'siege', strength: 7, ability: 'none' },
  { id: 'gr_bloodgolem', name: 'Осадный голем крови', type: 'unit', row: 'siege', strength: 6, ability: 'none' },
  { id: 'gr_hounds', name: 'Стая призрачных гончих', type: 'unit', row: 'siege', strength: 5, ability: 'none' },
  { id: 'gr_horn', name: 'Кровавый рёв', type: 'special', strength: 0, ability: 'horn' },
  { id: 'gr_medic', name: 'Некромант ордена', type: 'unit', row: 'melee', strength: 1, ability: 'medic' },
  { id: 'gr_decoy', name: 'Кровавая подмена', type: 'special', strength: 0, ability: 'decoy' },
  { id: 'gr_siege_beast', name: 'Осадная тварь', type: 'unit', row: 'siege', strength: 4, ability: 'none' },
  // Погода: 3 карты (заменяют gr_tracker, gr_ritualist; gr_beast заменён на Кровопийцу)
  { id: 'gr_fog', name: 'Плачущая лихорадка', type: 'weather', strength: 0, ability: 'fog' },
  { id: 'gr_frost', name: 'Дыхание Тартара', type: 'weather', strength: 0, ability: 'frost' },
  { id: 'gr_clear', name: 'Кровавое очищение', type: 'weather', strength: 0, ability: 'clear' },
]);

// =============================================================================
// ВЕКСИТАРСКИЕ ВЕДЬМЫ (vexitar_witches)
// Тёмное Королевство Векситар — ведьмы, демоны, вампиры, сказочные кошмары
// Пассивка: Ведьминский пакт — посмотреть верхнюю карту колоды в начале раунда
// Стиль: контроль и манипуляция — drain, lock, scorch, muster
// =============================================================================
const vexitarWitchesDeck: Card[] = makeCards('vexitar_witches', [
  // Melee
  { id: 'vw_grim_knight', name: 'Проклятый рыцарь', type: 'unit', row: 'melee', strength: 6, ability: 'none' },
  { id: 'vw_vampire_lord', name: 'Барон-вампир Страд', type: 'unit', row: 'melee', strength: 7, ability: 'drain' },
  { id: 'vw_werewolf', name: 'Оборотень Гризельды', type: 'unit', row: 'melee', strength: 5, ability: 'none' },
  { id: 'vw_witch_hunter', name: 'Ведьмин дозор', type: 'unit', row: 'melee', strength: 4, ability: 'lock' },
  { id: 'vw_hansel', name: 'Гензель и Гретель', type: 'unit', row: 'melee', strength: 5, ability: 'bond' },
  // Ranged
  { id: 'vw_hansel_2', name: 'Гензель и Гретель', type: 'unit', row: 'ranged', strength: 5, ability: 'bond' },
  { id: 'vw_baba_yaga', name: 'Младшая Яга', type: 'unit', row: 'ranged', strength: 4, ability: 'medic' },
  { id: 'vw_raven_witch', name: 'Воронья ведьма', type: 'unit', row: 'ranged', strength: 3, ability: 'spy' },
  { id: 'vw_pied_piper', name: 'Крысолов', type: 'unit', row: 'ranged', strength: 4, ability: 'none' },
  { id: 'vw_rat_1', name: 'Зачарованная крыса', type: 'unit', row: 'ranged', strength: 2, ability: 'muster' },
  { id: 'vw_rat_2', name: 'Зачарованная крыса', type: 'unit', row: 'ranged', strength: 2, ability: 'muster' },
  { id: 'vw_imp', name: 'Пленный бес', type: 'unit', row: 'ranged', strength: 3, ability: 'none' },
  // Siege
  { id: 'vw_golem', name: 'Мясной голем', type: 'unit', row: 'siege', strength: 7, ability: 'none' },
  { id: 'vw_demon', name: 'Пленный демон', type: 'unit', row: 'siege', strength: 8, ability: 'none' },
  { id: 'vw_nightmare', name: 'Ночной кошмар', type: 'special', strength: 0, ability: 'scorch' },
  { id: 'vw_tower', name: 'Башня ведьм', type: 'unit', row: 'siege', strength: 5, ability: 'morale' },
  // Спецкарты
  { id: 'vw_horn', name: 'Вой полной луны', type: 'special', strength: 0, ability: 'horn' },
  { id: 'vw_medic', name: 'Зиритовый некромант', type: 'unit', row: 'melee', strength: 1, ability: 'medic' },
  { id: 'vw_decoy', name: 'Подменыш', type: 'special', strength: 0, ability: 'decoy' },
  // Погода
  { id: 'vw_frost', name: 'Проклятие вечной зимы', type: 'weather', strength: 0, ability: 'frost' },
  { id: 'vw_fog', name: 'Ведьмин туман', type: 'weather', strength: 0, ability: 'fog' },
  { id: 'vw_clear', name: 'Рассвет над Векситаром', type: 'weather', strength: 0, ability: 'clear' },
]);

export const factions: Record<FactionId, Faction> = {
  lion_guard: {
    id: 'lion_guard',
    name: 'Львиная гвардия',
    leader: {
      id: 'leader_halgerd',
      name: 'Хальгер Бротен, Король-лев',
      faction: 'lion_guard',
      abilityId: 'rally_the_guard',
      ability: 'Сплочение гвардии: все карты в выбранном ряду получают +2 к силе до конца раунда',
    },
    deck: lionGuardDeck,
    passiveDescription: 'При выигрыше раунда тянет 1 карту из колоды',
  },
  imperial_dogs: {
    id: 'imperial_dogs',
    name: 'Имперские псы',
    leader: {
      id: 'leader_torvus',
      name: 'Граф Торвус Фердинанд Белаторес',
      faction: 'imperial_dogs',
      abilityId: 'imperial_informant',
      ability: 'Имперский осведомитель: посмотри 3 карты из руки противника и сбрось одну',
    },
    deck: imperialDogsDeck,
    passiveDescription: 'При ничьей в раунде побеждают Имперские псы',
  },
  litlad_partisans: {
    id: 'litlad_partisans',
    name: 'Литладские партизаны',
    leader: {
      id: 'leader_lifetree',
      name: 'Жизнедерево Тунграда',
      faction: 'litlad_partisans',
      abilityId: 'roots_of_tungrad',
      ability: 'Корни Тунграда: переместите до 2 своих карт между рядами',
    },
    deck: litladPartisansDeck,
    passiveDescription: 'Решает кто ходит первым в каждом раунде',
  },
  grey_rangers: {
    id: 'grey_rangers',
    name: 'Серые следопыты',
    leader: {
      id: 'leader_first',
      name: 'Первый Следопыт',
      faction: 'grey_rangers',
      abilityId: 'blood_ritual',
      ability: 'Кровавый ритуал: верните самую сильную карту из сброса на поле',
    },
    deck: greyRangersDeck,
    passiveDescription: '1 случайная карта остаётся на поле между раундами',
  },
  vexitar_witches: {
    id: 'vexitar_witches',
    name: 'Векситарские ведьмы',
    leader: {
      id: 'leader_griszelda',
      name: 'Гризельда Вечная',
      faction: 'vexitar_witches',
      abilityId: 'witches_curse',
      ability: 'Проклятие Гризельды: все карты в выбранном ряду противника получают -2 к силе',
    },
    deck: vexitarWitchesDeck,
    passiveDescription: 'Ведьминский пакт: посмотри верхнюю карту колоды в начале раунда',
  },
};

export function getDeckCopy(factionId: FactionId): Card[] {
  return factions[factionId].deck.map(c => ({ ...c }));
}
