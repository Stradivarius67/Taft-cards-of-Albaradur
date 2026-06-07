import fs from 'fs';
import path from 'path';

const ART_DIR = path.join(__dirname, '..', 'taft-client', 'src', 'assets', 'cards', 'originals');

// Expected card IDs per faction (base names, no _N suffix)
const EXPECTED: Record<string, string[]> = {
  lion_guard: [
    'lg_musketeer', 'lg_knight', 'lg_militia', 'lg_tribune', 'lg_swordsman',
    'lg_shooter', 'lg_cannoneer', 'lg_spy', 'lg_halfling', 'lg_scout',
    'lg_ballista', 'lg_golem', 'lg_engineer', 'lg_bombardier',
    'lg_horn', 'lg_medic', 'lg_decoy', 'lg_fog',
  ],
  imperial_dogs: [
    'id_legionary', 'id_bravadores', 'id_inquisitor', 'id_overseer',
    'id_spy', 'id_defector', 'id_colonial', 'id_mage',
    'id_yacht', 'id_cannon', 'id_mgash', 'id_mortar',
    'id_horn', 'id_medic', 'id_decoy', 'id_rain',
    'id_guard', 'id_crossbow', 'id_engineer',
  ],
  litlad_partisans: [
    'lp_hellgate', 'lp_eld', 'lp_priestess', 'lp_zealot', 'lp_catran',
    'lp_bard', 'lp_smuggler', 'lp_autumn', 'lp_alchemist', 'lp_berserker',
    'lp_druid', 'lp_gatekeeper', 'lp_weaver', 'lp_stoneshooter',
    'lp_horn', 'lp_medic', 'lp_decoy', 'lp_frost',
    'lp_hunter', 'lp_fisher', 'lp_catapult',
  ],
  grey_rangers: [
    'gr_swordsman', 'gr_bloodhunter', 'gr_minotaur', 'gr_chaoslord', 'gr_leonid',
    'gr_crossbow', 'gr_catcher', 'gr_wyvern', 'gr_bloodmage',
    'gr_tartar', 'gr_dragon', 'gr_bloodgolem', 'gr_hounds',
    'gr_horn', 'gr_medic', 'gr_decoy', 'gr_fog',
    'gr_tracker', 'gr_beast', 'gr_ritualist', 'gr_siege_beast',
  ],
};

const EXPECTED_LEADERS = ['leader_halgerd', 'leader_torvus', 'leader_lifetree', 'leader_first'];

const FACTION_NAMES: Record<string, string> = {
  lion_guard: 'Львиная гвардия',
  imperial_dogs: 'Имперские псы',
  litlad_partisans: 'Литладские партизаны',
  grey_rangers: 'Серые следопыты',
};

function existsArt(folder: string, baseName: string): boolean {
  const dir = path.join(ART_DIR, folder);
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).some(f => {
    const name = f.replace(/\.(png|webp)$/, '');
    return name === baseName;
  });
}

function makeBar(found: number, total: number, width = 16): string {
  const filled = Math.round((found / total) * width);
  return '\u2588'.repeat(filled) + '\u2592'.repeat(width - filled);
}

console.log('');
console.log('Фракция                  | Найдено | Всего | Прогресс');
console.log('\u2500'.repeat(56));

let totalFound = 0;
let totalExpected = 0;
const missing: string[] = [];

for (const [faction, cards] of Object.entries(EXPECTED)) {
  const total = cards.length;
  let found = 0;
  for (const cardId of cards) {
    if (existsArt(faction, cardId)) {
      found++;
    } else {
      missing.push(`${faction}/${cardId}`);
    }
  }
  totalFound += found;
  totalExpected += total;
  const pct = Math.round((found / total) * 100);
  const name = (FACTION_NAMES[faction] ?? faction).padEnd(24);
  console.log(`${name} |   ${String(found).padStart(2)}    |  ${String(total).padStart(2)}   | ${makeBar(found, total)} ${pct}%`);
}

// Leaders
{
  const total = EXPECTED_LEADERS.length;
  let found = 0;
  for (const lid of EXPECTED_LEADERS) {
    if (existsArt('leaders', lid)) {
      found++;
    } else {
      missing.push(`leaders/${lid}`);
    }
  }
  totalFound += found;
  totalExpected += total;
  const pct = Math.round((found / total) * 100);
  console.log(`${'Лидеры'.padEnd(24)} |   ${String(found).padStart(2)}    |   ${String(total).padStart(2)}  | ${makeBar(found, total)} ${pct}%`);
}

console.log('\u2500'.repeat(56));
const totalPct = Math.round((totalFound / totalExpected) * 100);
console.log(`${'Итого'.padEnd(24)} |   ${String(totalFound).padStart(2)}    |  ${String(totalExpected).padStart(2)}   |                   ${totalPct}%`);

if (missing.length > 0) {
  console.log('\nНедостающий арт:');
  for (const m of missing) {
    console.log(`  ${m}`);
  }
}
console.log('');
