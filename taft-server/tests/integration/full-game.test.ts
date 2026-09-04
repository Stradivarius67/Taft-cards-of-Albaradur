import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import express from 'express';
import cors from 'cors';
import { RoomManager } from '../../src/rooms/manager.js';
import { setupSocketHandlers } from '../../src/socket/handlers.js';

// ─── Test infrastructure ───

let httpServer: ReturnType<typeof createServer>;
let ioServer: Server;
let roomManager: RoomManager;
let port: number;

function createClient(): ClientSocket {
  return ioClient(`http://localhost:${port}`, {
    autoConnect: false,
    transports: ['websocket'],
  });
}

function waitFor<T = any>(socket: ClientSocket, event: string, timeout = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for '${event}'`)), timeout);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/** Wait for a state_update where the state matches the predicate */
function waitForState(socket: ClientSocket, predicate: (state: any) => boolean, timeout = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('state_update', handler);
      reject(new Error('Timeout waiting for matching state_update'));
    }, timeout);
    function handler(data: { state: any }) {
      if (predicate(data.state)) {
        clearTimeout(timer);
        socket.off('state_update', handler);
        resolve(data.state);
      }
    }
    socket.on('state_update', handler);
  });
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

beforeAll(async () => {
  const app = express();
  app.use(cors());
  httpServer = createServer(app);
  ioServer = new Server(httpServer, { cors: { origin: '*' } });
  roomManager = new RoomManager();
  setupSocketHandlers(ioServer, roomManager);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve();
    });
  });
});

afterAll(async () => {
  roomManager.destroy();
  ioServer.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

// ─── Helper: create a game room with two connected players ───

async function setupGame(faction1 = 'lion_guard', faction2 = 'imperial_dogs') {
  const p1 = createClient();
  const p2 = createClient();

  // Attach listeners BEFORE connecting to avoid missing events
  const p1Connected = waitFor(p1, 'connect');
  const p2Connected = waitFor(p2, 'connect');
  p1.connect();
  p2.connect();
  await Promise.all([p1Connected, p2Connected]);

  // Create room
  const roomCreated = waitFor<{ code: string }>(p1, 'room_created');
  const p1Session = waitFor<{ code: string; resumeToken: string }>(p1, 'session_ready');
  p1.emit('create_room');
  const { code } = await roomCreated;
  const session1 = await p1Session;

  // Join room
  const playerJoined = waitFor(p1, 'player_joined');
  const p2Session = waitFor<{ code: string; resumeToken: string }>(p2, 'session_ready');
  p2.emit('join_room', { code });
  const [, session2] = await Promise.all([playerJoined, p2Session]);

  // Select factions — listen for game_started BEFORE emitting
  const gs1 = waitFor<{ state: any }>(p1, 'game_started');
  const gs2 = waitFor<{ state: any }>(p2, 'game_started');
  p1.emit('select_faction', { faction: faction1 });
  p2.emit('select_faction', { faction: faction2 });

  const [s1, s2] = await Promise.all([gs1, gs2]);
  return { p1, p2, code, state1: s1.state, state2: s2.state, session1, session2 };
}

async function doRedraw(p1: ClientSocket, p2: ClientSocket) {
  // Start waiting for 'playing' phase BEFORE emitting
  const p1Playing = waitForState(p1, s => s.phase === 'playing');
  const p2Playing = waitForState(p2, s => s.phase === 'playing');

  p1.emit('redraw_cards', { cardIds: [] });
  p2.emit('redraw_cards', { cardIds: [] });

  const [state1, state2] = await Promise.all([p1Playing, p2Playing]);
  return { state1, state2 };
}

function cleanup(...sockets: ClientSocket[]) {
  sockets.forEach(s => s.disconnect());
}

// ─── Tests ───

describe('Integration: Full Game', () => {
  it('creates room, joins, selects factions, starts game', async () => {
    const { p1, p2, state1, state2 } = await setupGame();
    expect(state1.phase).toBe('redraw');
    expect(state2.phase).toBe('redraw');
    expect(state1.me.hand.length).toBe(10);
    expect(state2.me.hand.length).toBe(10);
    cleanup(p1, p2);
  });

  it('redraw phase → playing phase', async () => {
    const { p1, p2 } = await setupGame();
    const { state1 } = await doRedraw(p1, p2);
    expect(state1.phase).toBe('playing');
    cleanup(p1, p2);
  });

  it('play a card and verify state update', async () => {
    const { p1, p2 } = await setupGame();
    const { state1, state2 } = await doRedraw(p1, p2);

    // Determine who goes first
    const isP1Turn = state1.currentPlayerIndex === state1.myIndex;
    const activeSocket = isP1Turn ? p1 : p2;
    const activeState = isP1Turn ? state1 : state2;

    const unit = activeState.me.hand.find((c: any) => c.type === 'unit' && !c.flexibleRow && c.ability === 'none');
    if (!unit) { cleanup(p1, p2); return; }

    activeSocket.emit('play_card', { cardId: unit.id });
    const upd = await waitFor<{ state: any }>(activeSocket, 'state_update');
    expect(upd.state.me.hand.length).toBe(9);
    cleanup(p1, p2);
  });

  it('both pass → round ends and advances', async () => {
    const { p1, p2 } = await setupGame();
    const { state1, state2 } = await doRedraw(p1, p2);

    const isP1Turn = state1.currentPlayerIndex === state1.myIndex;
    const firstSocket = isP1Turn ? p1 : p2;
    const secondSocket = isP1Turn ? p2 : p1;

    // Wait for round 2 or game_over on both
    const p1Round2 = waitForState(p1, s => s.round >= 2 || s.phase === 'game_over');
    const p2Round2 = waitForState(p2, s => s.round >= 2 || s.phase === 'game_over');
    const roundResult = waitFor<{ winner: number | null; scores: [number, number] }>(p1, 'round_result');

    firstSocket.emit('pass');
    // Wait a bit to ensure ordering
    await delay(50);
    secondSocket.emit('pass');

    const [r1, r2] = await Promise.all([p1Round2, p2Round2]);
    expect((await roundResult).scores).toEqual([0, 0]);
    expect(r1.round).toBeGreaterThanOrEqual(2);
    cleanup(p1, p2);
  });

  it('full game to completion (3 rounds of empty passes)', async () => {
    const { p1, p2 } = await setupGame();
    const { state1, state2 } = await doRedraw(p1, p2);

    // With imperial_dogs, ties are won by them → game ends 2-0 after 2 rounds
    const gameOverP1 = waitForState(p1, s => s.phase === 'game_over', 10000);
    const gameOverP2 = waitForState(p2, s => s.phase === 'game_over', 10000);

    // Round 1: both pass
    const isP1First = state1.currentPlayerIndex === state1.myIndex;
    const first = isP1First ? p1 : p2;
    const second = isP1First ? p2 : p1;

    first.emit('pass');
    await delay(50);
    second.emit('pass');

    // Round 2: wait for playing phase, then both pass again
    const p1r2 = waitForState(p1, s => s.phase === 'playing' && s.round >= 2);
    const p2r2 = waitForState(p2, s => s.phase === 'playing' && s.round >= 2);
    await Promise.all([p1r2, p2r2]);

    // Determine turn for round 2
    const r2state = await p1r2;
    const isP1Turn2 = r2state.currentPlayerIndex === r2state.myIndex;
    const first2 = isP1Turn2 ? p1 : p2;
    const second2 = isP1Turn2 ? p2 : p1;

    first2.emit('pass');
    await delay(50);
    second2.emit('pass');

    const [final1] = await Promise.all([gameOverP1, gameOverP2]);
    expect(final1.phase).toBe('game_over');
    cleanup(p1, p2);
  }, 15000);
});

describe('Integration: Mirror Match', () => {
  it('same faction — card IDs have player prefixes', async () => {
    const { p1, p2, state1, state2 } = await setupGame('lion_guard', 'lion_guard');

    const p1Ids = state1.me.hand.map((c: any) => c.id);
    const p2Ids = state2.me.hand.map((c: any) => c.id);

    // All p1 cards should have p0_ prefix (p1 is player 0)
    for (const id of p1Ids) {
      expect(id).toMatch(/^p\d_/);
    }
    // All p2 cards should have different prefix
    for (const id of p2Ids) {
      expect(id).toMatch(/^p\d_/);
    }

    // No collisions between the two hands
    const allIds = [...p1Ids, ...p2Ids];
    expect(new Set(allIds).size).toBe(allIds.length);

    cleanup(p1, p2);
  });
});

describe('Integration: Invalid Actions', () => {
  it('rejects play_card when not your turn', async () => {
    const { p1, p2 } = await setupGame();
    const { state1, state2 } = await doRedraw(p1, p2);

    // Find who does NOT have the turn
    const isP1Turn = state1.currentPlayerIndex === state1.myIndex;
    const wrongSocket = isP1Turn ? p2 : p1;
    const wrongState = isP1Turn ? state2 : state1;

    const card = wrongState.me.hand[0];
    if (!card) { cleanup(p1, p2); return; }

    wrongSocket.emit('play_card', { cardId: card.id });
    const err = await waitFor<{ message: string }>(wrongSocket, 'error');
    expect(err.message).toContain('не ваш ход');
    cleanup(p1, p2);
  });

  it('rejects play_card with non-existent card', async () => {
    const { p1, p2 } = await setupGame();
    const { state1, state2 } = await doRedraw(p1, p2);

    const isP1Turn = state1.currentPlayerIndex === state1.myIndex;
    const activeSocket = isP1Turn ? p1 : p2;

    activeSocket.emit('play_card', { cardId: 'nonexistent_card_id' });
    const err = await waitFor<{ message: string }>(activeSocket, 'error');
    expect(err.message).toContain('Карты нет в руке');
    cleanup(p1, p2);
  });

  it('rejects redraw of 3+ cards', async () => {
    const { p1, p2, state1 } = await setupGame();
    const threeCards = state1.me.hand.slice(0, 3).map((c: any) => c.id);

    // Wait for next state_update (which will still be redraw since 3 cards is invalid)
    const nextState = waitForState(p1, s => true);
    p1.emit('redraw_cards', { cardIds: threeCards });
    const st = await nextState;
    // Should still be in redraw phase (3-card redraw was rejected but state_update sent)
    expect(st.phase).toBe('redraw');
    cleanup(p1, p2);
  });

  it('double pass is silently ignored', async () => {
    const { p1, p2 } = await setupGame();
    const { state1, state2 } = await doRedraw(p1, p2);

    const isP1Turn = state1.currentPlayerIndex === state1.myIndex;
    const firstSocket = isP1Turn ? p1 : p2;

    firstSocket.emit('pass');
    await waitFor(firstSocket, 'state_update');

    // Try to pass again — already passed, so this should be a no-op
    firstSocket.emit('pass');
    // No error, no state change. Just wait a bit.
    await delay(200);
    cleanup(p1, p2);
  });

  it('rejects malformed payloads without terminating the socket', async () => {
    const { p1, p2 } = await setupGame();
    const { state1 } = await doRedraw(p1, p2);
    const activeSocket = state1.currentPlayerIndex === state1.myIndex ? p1 : p2;

    const malformedError = waitFor<{ message: string }>(activeSocket, 'error');
    activeSocket.emit('play_card', null as any);
    expect((await malformedError).message).toContain('Некорректные данные');

    const update = waitFor<{ state: any }>(activeSocket, 'state_update');
    activeSocket.emit('pass');
    expect((await update).state.me.passed).toBe(true);
    cleanup(p1, p2);
  });
});

describe('Integration: Effects via Socket.IO', () => {
  it('weather card sets weather flag', async () => {
    const { p1, p2 } = await setupGame();
    const { state1, state2 } = await doRedraw(p1, p2);

    const isP1Turn = state1.currentPlayerIndex === state1.myIndex;
    const activeSocket = isP1Turn ? p1 : p2;
    const activeState = isP1Turn ? state1 : state2;

    const weatherCard = activeState.me.hand.find((c: any) => c.type === 'weather');
    if (!weatherCard) { cleanup(p1, p2); return; }

    activeSocket.emit('play_card', { cardId: weatherCard.id });
    const upd = await waitFor<{ state: any }>(activeSocket, 'state_update');

    const ability = weatherCard.ability as string;
    if (ability === 'frost') expect(upd.state.weather.frost).toBe(true);
    if (ability === 'fog') expect(upd.state.weather.fog).toBe(true);
    if (ability === 'rain') expect(upd.state.weather.rain).toBe(true);

    cleanup(p1, p2);
  });

  it('spy card goes to opponent field and draws cards', async () => {
    const { p1, p2 } = await setupGame('imperial_dogs', 'lion_guard');
    const { state1, state2 } = await doRedraw(p1, p2);

    // Imperial dogs (p1) has 3 spies. Find who has the turn.
    const isP1Turn = state1.currentPlayerIndex === state1.myIndex;
    const activeSocket = isP1Turn ? p1 : p2;
    const activeState = isP1Turn ? state1 : state2;

    const spyCard = activeState.me.hand.find((c: any) => c.ability === 'spy');
    if (!spyCard) { cleanup(p1, p2); return; }

    const handBefore = activeState.me.hand.length;
    activeSocket.emit('play_card', { cardId: spyCard.id });
    const upd = await waitFor<{ state: any }>(activeSocket, 'state_update');

    // Spy goes to opponent field
    const oppFieldCards = [
      ...upd.state.opponent.field.melee,
      ...upd.state.opponent.field.ranged,
      ...upd.state.opponent.field.siege,
    ];
    const spyOnOppField = oppFieldCards.find((c: any) => c.id === spyCard.id);
    expect(spyOnOppField).toBeDefined();

    // Player drew 2 cards (hand = handBefore - 1 + 2)
    expect(upd.state.me.hand.length).toBe(handBefore - 1 + 2);

    cleanup(p1, p2);
  });

  it('medic on empty discard — no prompt, card on field', async () => {
    const { p1, p2 } = await setupGame();
    const { state1, state2 } = await doRedraw(p1, p2);

    const isP1Turn = state1.currentPlayerIndex === state1.myIndex;
    const activeSocket = isP1Turn ? p1 : p2;
    const activeState = isP1Turn ? state1 : state2;

    const medicCard = activeState.me.hand.find((c: any) => c.ability === 'medic' && !c.flexibleRow);
    if (!medicCard) { cleanup(p1, p2); return; }

    activeSocket.emit('play_card', { cardId: medicCard.id });
    const upd = await waitFor<{ state: any }>(activeSocket, 'state_update');

    const allMyField = [
      ...upd.state.me.field.melee,
      ...upd.state.me.field.ranged,
      ...upd.state.me.field.siege,
    ];
    const medicOnField = allMyField.find((c: any) => c.id === medicCard.id);
    expect(medicOnField).toBeDefined();

    cleanup(p1, p2);
  });
});

describe('Integration: Disconnect', () => {
  it('restores a waiting lobby without requiring a second player', async () => {
    const host = createClient();
    const connected = waitFor(host, 'connect');
    host.connect();
    await connected;

    const created = waitFor<{ code: string }>(host, 'room_created');
    const session = waitFor<{ code: string; resumeToken: string }>(host, 'session_ready');
    host.emit('create_room');
    const [{ code }, { resumeToken }] = await Promise.all([created, session]);
    host.disconnect();
    await delay(20);

    const replacement = createClient();
    const replacementConnected = waitFor(replacement, 'connect');
    replacement.connect();
    await replacementConnected;
    const restored = waitFor<any>(replacement, 'lobby_restored');
    replacement.emit('reconnect', { code: code.toLowerCase(), resumeToken });

    expect(await restored).toMatchObject({ code, phase: 'waiting', playerIndex: 0 });
    cleanup(replacement);
  });

  it('opponent_disconnected event is sent', async () => {
    const { p1, p2 } = await setupGame();
    await doRedraw(p1, p2);

    const disconnectPromise = waitFor(p2, 'opponent_disconnected', 3000);
    p1.disconnect();
    await disconnectPromise;
    p2.disconnect();
  });

  it('requires the private resume token and restores the correct player slot', async () => {
    const { p1, p2, code, session1 } = await setupGame();
    await doRedraw(p1, p2);

    const disconnected = waitFor(p2, 'opponent_disconnected');
    p1.disconnect();
    await disconnected;

    const attacker = createClient();
    const attackerConnected = waitFor(attacker, 'connect');
    attacker.connect();
    await attackerConnected;
    const rejected = waitFor<{ message: string }>(attacker, 'session_invalid');
    attacker.emit('reconnect', { code, resumeToken: 'invalid-token' });
    expect((await rejected).message).toContain('подтвердить');

    const replacement = createClient();
    const replacementConnected = waitFor(replacement, 'connect');
    replacement.connect();
    await replacementConnected;
    const resumed = waitFor<{ code: string; resumeToken: string }>(replacement, 'session_ready');
    const state = waitFor<{ state: any }>(replacement, 'state_update');
    replacement.emit('reconnect', { code: code.toLowerCase(), resumeToken: session1.resumeToken });

    const renewedSession = await resumed;
    expect(renewedSession.code).toBe(code);
    expect(renewedSession.resumeToken).not.toBe(session1.resumeToken);
    expect((await state).state.myIndex).toBe(0);
    cleanup(p2, attacker, replacement);
  });

  it('replays a pending roots prompt after reconnect', async () => {
    const { p1, p2, code, session1 } = await setupGame();
    await doRedraw(p1, p2);
    const room = roomManager.getRoom(code)!;
    room.gameState.phase = 'playing';
    room.gameState.currentPlayerIndex = 0;
    room.gameState.pendingAction = 'roots_move';
    room.gameState.pendingActionPlayer = 0;

    const disconnected = waitFor(p2, 'opponent_disconnected');
    p1.disconnect();
    await disconnected;

    const replacement = createClient();
    const connected = waitFor(replacement, 'connect');
    replacement.connect();
    await connected;
    const state = waitFor(replacement, 'state_update');
    const prompt = waitFor(replacement, 'roots_prompt');
    replacement.emit('reconnect', { code, resumeToken: session1.resumeToken });

    await Promise.all([state, prompt]);
    cleanup(p2, replacement);
  });

  it('replays the final result after reconnect', async () => {
    const { p1, p2, code, session1 } = await setupGame();
    const room = roomManager.getRoom(code)!;
    room.gameState.phase = 'game_over';
    room.gameState.players[0].roundsWon = 2;

    const disconnected = waitFor(p2, 'opponent_disconnected');
    p1.disconnect();
    await disconnected;

    const replacement = createClient();
    const connected = waitFor(replacement, 'connect');
    replacement.connect();
    await connected;
    const gameOver = waitFor<{ winner: number | null; finalScore: [number, number] }>(replacement, 'game_over');
    replacement.emit('reconnect', { code, resumeToken: session1.resumeToken });

    expect(await gameOver).toEqual({ winner: 0, finalScore: [2, 0] });
    cleanup(p2, replacement);
  });
});

describe('Integration: Card Count Invariant', () => {
  it('22 cards per player after start', async () => {
    const { p1, p2, state1 } = await setupGame();
    const total = state1.me.hand.length + state1.me.deck.count;
    expect(total).toBe(22);
    cleanup(p1, p2);
  });

  it('22 cards per player after playing a unit card', async () => {
    const { p1, p2 } = await setupGame();
    const { state1, state2 } = await doRedraw(p1, p2);

    const isP1Turn = state1.currentPlayerIndex === state1.myIndex;
    const activeSocket = isP1Turn ? p1 : p2;
    const activeState = isP1Turn ? state1 : state2;

    const unit = activeState.me.hand.find((c: any) => c.type === 'unit' && !c.flexibleRow && c.ability === 'none');
    if (!unit) { cleanup(p1, p2); return; }

    activeSocket.emit('play_card', { cardId: unit.id });
    const upd = await waitFor<{ state: any }>(activeSocket, 'state_update');

    const me = upd.state.me;
    const fieldCount = me.field.melee.length + me.field.ranged.length + me.field.siege.length;
    const total = me.hand.length + me.deck.count + me.discard.length + fieldCount;
    expect(total).toBe(22);

    cleanup(p1, p2);
  });

  it('22 cards per player after playing weather card', async () => {
    const { p1, p2 } = await setupGame();
    const { state1, state2 } = await doRedraw(p1, p2);

    const isP1Turn = state1.currentPlayerIndex === state1.myIndex;
    const activeSocket = isP1Turn ? p1 : p2;
    const activeState = isP1Turn ? state1 : state2;

    const weatherCard = activeState.me.hand.find((c: any) => c.type === 'weather');
    if (!weatherCard) { cleanup(p1, p2); return; }

    activeSocket.emit('play_card', { cardId: weatherCard.id });
    const upd = await waitFor<{ state: any }>(activeSocket, 'state_update');

    const me = upd.state.me;
    const fieldCount = me.field.melee.length + me.field.ranged.length + me.field.siege.length;
    const total = me.hand.length + me.deck.count + me.discard.length + fieldCount;
    expect(total).toBe(22);

    cleanup(p1, p2);
  });
});
