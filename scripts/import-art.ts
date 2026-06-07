import fs from 'fs';
import path from 'path';

const IMPERIAL_DOGS_MAP: Record<string, string> = {
  '2 Бравадорес.png':              'id_bravadores.png',
  'Боевой орк Мгаш.png':          'id_mgash.png',
  'Воздушный Ялик.png':            'id_yacht.png',
  'Граф Торвус Фердинанд.png':     'leader_torvus.png',
  'Имперский Арбалетчик.png':      'id_crossbow.png',
  'Имперский Гвардеец.png':        'id_guard.png',
  'Имперский Легионер.png':        'id_legionary.png',
  'Имперский Шпион.png':           'id_spy.png',
  'Инквизитор Храмовников.png':    'id_inquisitor.png',
  'Колониальный стрелок.png':      'id_colonial.png',
  'Маг Круга.png':                 'id_mage.png',
  'Надсмотрщик Рудников.png':      'id_overseer.png',
  'Перебежчик-тифлинг.png':        'id_defector.png',
  'Торналез.png':                  'id_cannon.png',
  // Новые карты (Block 2/3)
  'Цепной Маг.png':               'id_lock.png',
  'Пороховая мортира.png':        'id_mortar.png',
  'Имперский рожок.png':          'id_horn.png',
  'Полевой хирург.png':           'id_medic.png',
  'Двойной агент.png':            'id_decoy.png',
  'Имперский Палач.png':          'id_scorch.png',
  'Пороховой дым.png':            'id_rain.png',
  'Колониальный туман.png':       'id_fog.png',
  'Приказ Императора.png':        'id_clear.png',
};

const LION_GUARD_MAP: Record<string, string> = {
  'Варийский Шпион.png':             'lg_spy.png',
  'Горийский Бомбардир.png':         'lg_bombardier.png',
  'Горийский Ополченец.png':         'lg_militia.png',
  'Горийский разведчик.png':         'lg_scout.png',
  'Зачарованный рожок.png':          'lg_horn.png',
  'Львиный Мушкетер.png':            'lg_musketeer.png',
  'мечник Конгламирата.png':         'lg_swordsman.png',
  'Обманный манёвр.png':             'lg_decoy.png',
  'Осадный голем Астальдиса.png':    'lg_golem.png',
  'Паровая баллиста.png':            'lg_ballista.png',
  'Полевой лекарь.png':              'lg_medic.png',
  'Полурослик-разведчик.png':        'lg_halfling.png',
  'Рунный Канонир.png':              'lg_cannoneer.png',
  'Рыцарь Варии.png':                'lg_knight.png',
  'Стрелок Конгламирата.png':        'lg_shooter.png',
  'Трибун Народа.png':               'lg_tribune.png',
  'Фабричный Инжинер.png':           'lg_engineer.png',
  'Фабричный Смог.png':              'lg_fog.png',
  'Хальгерд Бротен Король-лев.png':  'leader_halgerd.png',
  // Новые карты (Block 3)
  'Горийская Вьюга.png':             'lg_frost.png',
  'Ветер Перемен.png':               'lg_clear.png',
};

const LITLAD_PARTISANS_MAP: Record<string, string> = {
  'Ополченец Тунграда.png':        'lp_hellgate.png',
  'Элдьд Охотник.png':             'lp_eld.png',
  'Жрица Боваса.png':              'lp_priestess.png',
  'Ревнитель Сангрейва.png':       'lp_zealot.png',
  'Наездник на Катране.png':       'lp_catran.png',
  'Бард Тунграда.png':             'lp_bard.png',
  'Контрабандист Залива.png':      'lp_smuggler.png',
  'Рыцарь Осени.png':             'lp_autumn.png',
  'Алхимик Тунграда.png':         'lp_alchemist.png',
  'Фирболг берсерк.png':          'lp_berserker.png',
  'Друид плачущего леса.png':      'lp_druid.png',
  'Стражник врат.png':             'lp_gatekeeper.png',
  'Золотой Гобеленщик.png':       'lp_weaver.png',
  'Каменный стрелок.png':         'lp_stoneshooter.png',
  'Рог трех Городов.png':         'lp_horn.png',
  'Травник-целитель.png':         'lp_medic.png',
  'Подмена.png':                   'lp_decoy.png',
  'Ледяной ветер с гор.png':      'lp_frost.png',
  'Охотник залива.png':            'lp_hunter.png',
  'Рыбак Хеллгейта.png':          'lp_fisher.png',
  'Катапульта Сангрейва.png':     'lp_catapult.png',
  'Жизнедерево Тунграда.png':     'leader_lifetree.png',
  // Новые карты (Block 2/3)
  'Партизан Литлада.png':          'lp_partisan.png',
  'Слезы Игадриэля.png':          'lp_rain.png',
  'Благословение рощи.png':       'lp_clear.png',
};

const VEXITAR_WITCHES_MAP: Record<string, string> = {
  'Проклятый рыцарь.png':         'vw_grim_knight.png',
  'Барон-вампир Страд.png':       'vw_vampire_lord.png',
  'Оборотень Гризельды.png':      'vw_werewolf.png',
  'Ведьмин Дозор.png':            'vw_witch_hunter.png',
  'Гензель и Гретель.png':        'vw_hansel.png',
  'Младшая яга.png':              'vw_baba_yaga.png',
  'Воронья Ведьма.png':           'vw_raven_witch.png',
  'Крысолов.png':                  'vw_pied_piper.png',
  'Зачарованная крыса.png':       'vw_rat.png',
  'Пленный бес.png':              'vw_imp.png',
  'Мясной голем.png':              'vw_golem.png',
  'Пленный демон.png':            'vw_demon.png',
  'Ночной кошмар.png':            'vw_nightmare.png',
  'Башня ведьм.png':              'vw_tower.png',
  'Вой полной луны.png':          'vw_horn.png',
  'Зиритовый Некромант.png':      'vw_medic.png',
  'Подменыш.png':                  'vw_decoy.png',
  'Вечный холод.png':             'vw_frost.png',
  'Ведьмин Туман.png':            'vw_fog.png',
  'Рассвет над Векситаром.png':   'vw_clear.png',
  'Гризельда.png':                 'leader_griszelda.png',
};

const GREY_RANGERS_MAP: Record<string, string> = {
  'Первый следопыт.png':           'leader_first.png',
  'Следопыт-мечник.png':           'gr_swordsman.png',
  'Кровавый охотник.png':          'gr_bloodhunter.png',
  'Подчиненный минотавр.png':      'gr_minotaur.png',
  'Ловчий Хаоса.png':              'gr_chaoslord.png',
  'Порабощенный леониец.png':      'gr_leonid.png',
  'Кровопийца.png':                 'gr_drain.png',
  'Следопыт-арбаледчик.png':       'gr_crossbow.png',
  'Ловец Тварей.png':              'gr_catcher.png',
  'Подчиненный виверн.png':        'gr_wyvern.png',
  'Кровавый маг.png':              'gr_bloodmage.png',
  'Тварь из Тартара.png':          'gr_tartar.png',
  'Подчиненный дракон.png':        'gr_dragon.png',
  'Осадный голем крови.png':       'gr_bloodgolem.png',
  'Стая призрачных гончих.png':    'gr_hounds.png',
  'Кровавый рёв.png':              'gr_horn.png',
  'Некромант ордена.png':          'gr_medic.png',
  'Кровавая подмена.png':          'gr_decoy.png',
  'Осадная тварь.png':             'gr_siege_beast.png',
  'Плачущая лихорадка.png':        'gr_fog.png',
  'Дыхание Тартара.png':           'gr_frost.png',
  'Кровавое очищение.png':         'gr_clear.png',
  // Следопыт-разведчик удалён из колоды, но арт импортируем для сброса/истории
  'Следопыт-разведчик.png':        'gr_tracker.png',
};

const SOURCE_DIR = process.argv[2] || path.join(__dirname, '..', 'Графика');
const TARGET_DIR = path.join(__dirname, '..', 'taft-client', 'src', 'assets', 'cards', 'originals');

function copyWithMapping(
  sourceFolder: string,
  mapping: Record<string, string>,
  factionFolder: string,
  leaderFolder: string,
) {
  const srcDir = path.join(SOURCE_DIR, sourceFolder);
  if (!fs.existsSync(srcDir)) {
    console.error(`  Папка не найдена: ${srcDir}`);
    return;
  }

  fs.mkdirSync(path.join(TARGET_DIR, factionFolder), { recursive: true });
  fs.mkdirSync(path.join(TARGET_DIR, leaderFolder), { recursive: true });

  let copied = 0;
  let skipped = 0;

  for (const [srcName, destName] of Object.entries(mapping)) {
    const srcPath = path.join(srcDir, srcName);
    if (!fs.existsSync(srcPath)) {
      console.log(`  [SKIP] ${srcName} — файл не найден`);
      skipped++;
      continue;
    }
    const isLeader = destName.startsWith('leader_');
    const destDir = isLeader ? leaderFolder : factionFolder;
    const destPath = path.join(TARGET_DIR, destDir, destName);
    fs.copyFileSync(srcPath, destPath);
    console.log(`  [OK]   ${srcName} → ${destDir}/${destName}`);
    copied++;
  }

  console.log(`  Итого: ${copied} скопировано, ${skipped} пропущено\n`);
}

console.log('=== Импорт арта карт ===\n');
console.log(`Источник: ${SOURCE_DIR}`);
console.log(`Назначение: ${TARGET_DIR}\n`);

console.log('--- Имперские псы ---');
copyWithMapping('Империя.art', IMPERIAL_DOGS_MAP, 'imperial_dogs', 'leaders');

console.log('--- Львиная гвардия ---');
copyWithMapping('Конгламират.art', LION_GUARD_MAP, 'lion_guard', 'leaders');

console.log('--- Литладские партизаны ---');
copyWithMapping('Литла.art', LITLAD_PARTISANS_MAP, 'litlad_partisans', 'leaders');

console.log('--- Серые следопыты ---');
copyWithMapping('Серые следопыты.art', GREY_RANGERS_MAP, 'grey_rangers', 'leaders');

console.log('--- Векситарские ведьмы ---');
copyWithMapping('Ведьмы.art', VEXITAR_WITCHES_MAP, 'vexitar_witches', 'leaders');

console.log('Готово!');
