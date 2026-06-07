import { GameState } from '../types.js';

export function gameLog(roomCode: string, message: string): void {
  const time = new Date().toLocaleTimeString('en-GB');
  console.log(`[${time}] [ROOM:${roomCode}] ${message}`);
}

/**
 * Validate state invariants after every mutation.
 * Logs errors to console — does NOT throw.
 */
export function validateStateInvariants(event: string, state: GameState, roomCode: string): void {
  const errors: string[] = [];

  // Global card count: all cards across both players = 44
  // Spies move cards between players, so per-player count can deviate.
  // Check global total instead.
  if (state.players.length === 2) {
    let globalTotal = 0;
    const allGlobalIds: string[] = [];

    for (let i = 0; i < 2; i++) {
      const player = state.players[i];
      const fieldCount =
        player.field.melee.length +
        player.field.ranged.length +
        player.field.siege.length;
      globalTotal += player.hand.length + player.deck.length + player.discard.length + fieldCount;

      const allCards = [
        ...player.hand, ...player.deck, ...player.discard,
        ...player.field.melee, ...player.field.ranged, ...player.field.siege,
      ];
      allGlobalIds.push(...allCards.map(c => c.id));
    }

    if (globalTotal !== 44) {
      errors.push(`Global card count ${globalTotal} != 44`);
    }

    // No duplicate IDs across entire game
    const uniqueIds = new Set(allGlobalIds);
    if (uniqueIds.size !== allGlobalIds.length) {
      const dupes = allGlobalIds.filter((id, idx) => allGlobalIds.indexOf(id) !== idx);
      errors.push(`Duplicate card IDs: ${[...new Set(dupes)].join(', ')}`);
    }
  }

  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];

    // roundsWon <= round
    if (player.roundsWon > state.round) {
      errors.push(`P${i} roundsWon (${player.roundsWon}) > round (${state.round})`);
    }
  }

  if (errors.length > 0) {
    const time = new Date().toLocaleTimeString('en-GB');
    console.error(`[${time}] [ROOM:${roomCode}] [INVARIANT VIOLATION] after ${event}:`);
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
  }
}
