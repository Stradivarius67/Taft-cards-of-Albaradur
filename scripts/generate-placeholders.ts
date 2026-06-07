import fs from 'fs';
import path from 'path';

// Expected card IDs per faction
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

const FACTION_COLORS: Record<string, [number, number, number]> = {
  lion_guard: [212, 168, 67],
  imperial_dogs: [192, 57, 43],
  litlad_partisans: [39, 174, 96],
  grey_rangers: [127, 140, 141],
  leaders: [180, 180, 180],
};

const ART_DIR = path.join(__dirname, '..', 'taft-client', 'src', 'assets', 'cards', 'originals');

function existsArt(folder: string, baseName: string): boolean {
  const dir = path.join(ART_DIR, folder);
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).some(f => f.replace(/\.(png|webp)$/, '') === baseName);
}

// Minimal 1x1 PNG generator (colored pixel)
function createColoredPng(r: number, g: number, b: number): Buffer {
  // 8-bit RGBA 1x1 PNG (smallest valid PNG)
  const HEADER = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
  ]);

  function chunk(type: string, data: Buffer): Buffer {
    const typeB = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const combined = Buffer.concat([typeB, data]);
    const { createHash } = require('crypto');
    // CRC32 is complex; use zlib instead
    const zlib = require('zlib');
    const crc = Buffer.alloc(4);
    crc.writeInt32BE(zlib.crc32(combined));
    return Buffer.concat([len, combined, crc]);
  }

  // IHDR: 1x1 8bit RGBA
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);  // width
  ihdr.writeUInt32BE(1, 1);  // height — wait, this overwrites
  // Let me do it properly
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(1, 0);  // width
  ihdrData.writeUInt32BE(1, 4);  // height
  ihdrData[8] = 8;   // bit depth
  ihdrData[9] = 2;   // color type RGB
  ihdrData[10] = 0;  // compression
  ihdrData[11] = 0;  // filter
  ihdrData[12] = 0;  // interlace

  // IDAT: filter byte (0) + RGB
  const zlib = require('zlib');
  const raw = Buffer.from([0, r, g, b]);
  const compressed = zlib.deflateSync(raw);

  const iend = Buffer.alloc(0);

  return Buffer.concat([
    HEADER,
    chunk('IHDR', ihdrData),
    chunk('IDAT', compressed),
    chunk('IEND', iend),
  ]);
}

let generated = 0;
let skipped = 0;

for (const [faction, cards] of Object.entries(EXPECTED)) {
  const color = FACTION_COLORS[faction] ?? [100, 100, 100];
  const dir = path.join(ART_DIR, faction);
  fs.mkdirSync(dir, { recursive: true });

  for (const cardId of cards) {
    if (existsArt(faction, cardId)) {
      skipped++;
      continue;
    }
    const pngData = createColoredPng(color[0], color[1], color[2]);
    fs.writeFileSync(path.join(dir, `${cardId}.png`), pngData);
    console.log(`  [GEN] ${faction}/${cardId}.png`);
    generated++;
  }
}

// Leaders
const leadersDir = path.join(ART_DIR, 'leaders');
fs.mkdirSync(leadersDir, { recursive: true });
const lColor = FACTION_COLORS.leaders;
for (const lid of EXPECTED_LEADERS) {
  if (existsArt('leaders', lid)) {
    skipped++;
    continue;
  }
  const pngData = createColoredPng(lColor[0], lColor[1], lColor[2]);
  fs.writeFileSync(path.join(leadersDir, `${lid}.png`), pngData);
  console.log(`  [GEN] leaders/${lid}.png`);
  generated++;
}

console.log(`\nГенерация заглушек завершена: ${generated} создано, ${skipped} пропущено (арт уже есть)`);
