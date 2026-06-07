import { factions } from '../src/game/factions.js';
import { GameEngine } from '../src/game/engine.js';
import type { Card, FactionId, CardRow } from '../src/types.js';

interface FactionStats {
  faction: string;
  factionId: FactionId;
  totalStrength: number;
  avgCardStrength: number;
  unitCount: number;
  specialCount: number;
  spyCount: number;
  bondPairs: number;
  moraleCount: number;
  medicCount: number;
  maxPossibleStrength: number;
  flexibleCount: number;
}

const engine = new GameEngine();

function computeStats(factionId: FactionId): FactionStats {
  const faction = factions[factionId];
  const deck = faction.deck;

  const units = deck.filter(c => c.type === 'unit');
  const specials = deck.filter(c => c.type === 'special' || c.type === 'weather');
  const spies = deck.filter(c => c.ability === 'spy');
  const morales = deck.filter(c => c.ability === 'morale');
  const medics = deck.filter(c => c.ability === 'medic');
  const flexible = deck.filter(c => c.flexibleRow);

  // Bond groups
  const bondCards = deck.filter(c => c.ability === 'bond');
  const bondNames = new Set(bondCards.map(c => c.name));

  const totalStrength = deck.reduce((sum, c) => sum + c.strength, 0);

  // Max possible strength: all units on field, bond active, morale active, horn on each row
  // Place cards by row, apply bond*2, morale+1, sum, horn*2
  const rows: Record<CardRow, Card[]> = { melee: [], ranged: [], siege: [] };
  for (const card of units) {
    if (card.ability === 'spy') continue; // spies go to opponent
    const row = card.row || 'melee'; // flexible defaults to melee for max calc
    rows[row].push(card);
  }

  let maxStrength = 0;
  for (const rowName of ['melee', 'ranged', 'siege'] as CardRow[]) {
    const rowCards = rows[rowName];
    if (rowCards.length === 0) continue;
    maxStrength += engine.calculateRowStrength(rowCards, false, true); // horn=true, no weather
  }

  return {
    faction: faction.name,
    factionId,
    totalStrength,
    avgCardStrength: +(totalStrength / deck.length).toFixed(1),
    unitCount: units.length,
    specialCount: specials.length,
    spyCount: spies.length,
    bondPairs: bondNames.size,
    moraleCount: morales.length,
    medicCount: medics.length,
    maxPossibleStrength: maxStrength,
    flexibleCount: flexible.length,
  };
}

// Compute stats for all factions
const allStats: FactionStats[] = [];
for (const factionId of Object.keys(factions) as FactionId[]) {
  allStats.push(computeStats(factionId));
}

// Print table
console.log('');
console.log('=== BALANCE CHECK ===');
console.log('');

const header = [
  'Faction'.padEnd(25),
  'Total'.padStart(6),
  'Avg'.padStart(5),
  'Units'.padStart(6),
  'Spies'.padStart(6),
  'Bonds'.padStart(6),
  'Morale'.padStart(7),
  'Medic'.padStart(6),
  'Flex'.padStart(5),
  'Max Str'.padStart(8),
].join(' | ');

console.log(header);
console.log('-'.repeat(header.length));

for (const s of allStats) {
  console.log([
    s.faction.padEnd(25),
    String(s.totalStrength).padStart(6),
    String(s.avgCardStrength).padStart(5),
    String(s.unitCount).padStart(6),
    String(s.spyCount).padStart(6),
    String(s.bondPairs).padStart(6),
    String(s.moraleCount).padStart(7),
    String(s.medicCount).padStart(6),
    String(s.flexibleCount).padStart(5),
    String(s.maxPossibleStrength).padStart(8),
  ].join(' | '));
}

console.log('');
console.log('Notes:');
console.log('- Total = sum of all card strengths in deck');
console.log('- Max Str = theoretical max with all non-spy units + bond + morale + horn, no weather');
console.log('- Spies give strength to opponent but draw 2 cards');
console.log('');

// Per-row breakdown
console.log('=== PER-ROW BREAKDOWN (unit strength, excluding spies) ===');
console.log('');
for (const s of allStats) {
  const deck = factions[s.factionId].deck;
  const rowStr: Record<string, number> = { melee: 0, ranged: 0, siege: 0 };
  const rowCount: Record<string, number> = { melee: 0, ranged: 0, siege: 0 };
  for (const c of deck) {
    if (c.type !== 'unit' || c.ability === 'spy') continue;
    const row = c.row || 'melee';
    rowStr[row] += c.strength;
    rowCount[row]++;
  }
  console.log(`${s.faction}:`);
  console.log(`  Melee:  ${rowCount.melee} cards, ${rowStr.melee} str`);
  console.log(`  Ranged: ${rowCount.ranged} cards, ${rowStr.ranged} str`);
  console.log(`  Siege:  ${rowCount.siege} cards, ${rowStr.siege} str`);
}
console.log('');
