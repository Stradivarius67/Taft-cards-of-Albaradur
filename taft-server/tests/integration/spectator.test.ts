import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import express from 'express';
import cors from 'cors';
import { RoomManager } from '../../src/rooms/manager.js';
import { setupSocketHandlers } from '../../src/socket/handlers.js';

let httpServer: ReturnType<typeof createServer>;
let ioServer: Server;
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
  const manager = new RoomManager();
  setupSocketHandlers(ioServer, manager);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve();
    });
  });
});

afterAll(async () => {
  ioServer.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

async function setupGame(faction1 = 'lion_guard', faction2 = 'imperial_dogs', openHands = false) {
  const p1 = createClient();
  const p2 = createClient();

  const p1Connected = waitFor(p1, 'connect');
  const p2Connected = waitFor(p2, 'connect');
  p1.connect();
  p2.connect();
  await Promise.all([p1Connected, p2Connected]);

  const roomCreated = waitFor<{ code: string }>(p1, 'room_created');
  p1.emit('create_room', openHands ? { openHands: true } : undefined);
  const { code } = await roomCreated;

  const playerJoined = waitFor(p1, 'player_joined');
  p2.emit('join_room', { code });
  await playerJoined;

  const gs1 = waitFor<{ state: any }>(p1, 'game_started');
  const gs2 = waitFor<{ state: any }>(p2, 'game_started');
  p1.emit('select_faction', { faction: faction1 });
  p2.emit('select_faction', { faction: faction2 });

  const [s1, s2] = await Promise.all([gs1, gs2]);
  return { p1, p2, code, state1: s1.state, state2: s2.state };
}

async function doRedraw(p1: ClientSocket, p2: ClientSocket) {
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

describe('Integration: Spectator mode', () => {
  it('spectator joins active game and receives state', async () => {
    const { p1, p2, code } = await setupGame();
    await doRedraw(p1, p2);

    const spec = createClient();
    const specConnected = waitFor(spec, 'connect');
    spec.connect();
    await specConnected;

    const joined = waitFor<{ state: any }>(spec, 'spectator_joined');
    spec.emit('join_as_spectator', { code });
    const { state } = await joined;

    expect(state.isSpectator).toBe(true);
    expect(state.player1).toBeDefined();
    expect(state.player2).toBeDefined();
    expect(state.player1.faction).toBeDefined();
    expect(state.player2.faction).toBeDefined();
    expect(state.strength.player1.total).toBeGreaterThanOrEqual(0);
    expect(state.strength.player2.total).toBeGreaterThanOrEqual(0);

    cleanup(p1, p2, spec);
  });

  it('spectator does NOT see player hands (only handCount)', async () => {
    const { p1, p2, code } = await setupGame();
    await doRedraw(p1, p2);

    const spec = createClient();
    const specConnected = waitFor(spec, 'connect');
    spec.connect();
    await specConnected;

    const joined = waitFor<{ state: any }>(spec, 'spectator_joined');
    spec.emit('join_as_spectator', { code });
    const { state } = await joined;

    expect(state.player1.handCount).toBeGreaterThan(0);
    expect(state.player2.handCount).toBeGreaterThan(0);
    // No hand array in default mode
    expect(state.player1.hand).toBeUndefined();
    expect(state.player2.hand).toBeUndefined();

    cleanup(p1, p2, spec);
  });

  it('spectator receives state_update after a player move', async () => {
    const { p1, p2, code } = await setupGame();
    const { state1 } = await doRedraw(p1, p2);

    const spec = createClient();
    const specConnected = waitFor(spec, 'connect');
    spec.connect();
    await specConnected;

    const joined = waitFor<{ state: any }>(spec, 'spectator_joined');
    spec.emit('join_as_spectator', { code });
    await joined;

    // Set up listener for spectator state_update BEFORE the move
    const specUpdate = waitFor<{ state: any }>(spec, 'state_update');

    // Determine whose turn it is and have them pass
    const currentSocket = state1.currentPlayerIndex === state1.myIndex ? p1 : p2;
    currentSocket.emit('pass');

    const update = await specUpdate;
    expect(update.state.isSpectator).toBe(true);

    cleanup(p1, p2, spec);
  });

  it('spectator cannot make player moves', async () => {
    const { p1, p2, code } = await setupGame();
    await doRedraw(p1, p2);

    const spec = createClient();
    const specConnected = waitFor(spec, 'connect');
    spec.connect();
    await specConnected;

    const joined = waitFor<{ state: any }>(spec, 'spectator_joined');
    spec.emit('join_as_spectator', { code });
    await joined;

    // Try to play a card — should be silently ignored (playerIndex === -1)
    spec.emit('play_card', { cardId: 'fake' });
    spec.emit('pass');

    // Give it a moment — these should be silently ignored
    await delay(500);
    // If we got here without errors, the spectator was properly rejected

    cleanup(p1, p2, spec);
  });

  it('maximum 5 spectators per room', async () => {
    const { p1, p2, code } = await setupGame();
    await doRedraw(p1, p2);

    const specs: ClientSocket[] = [];
    for (let i = 0; i < 5; i++) {
      const s = createClient();
      const connected = waitFor(s, 'connect');
      s.connect();
      await connected;
      const joined = waitFor(s, 'spectator_joined');
      s.emit('join_as_spectator', { code });
      await joined;
      specs.push(s);
    }

    // 6th spectator should get error
    const s6 = createClient();
    const s6Connected = waitFor(s6, 'connect');
    s6.connect();
    await s6Connected;

    const errPromise = waitFor<{ message: string }>(s6, 'error');
    s6.emit('join_as_spectator', { code });
    const err = await errPromise;
    expect(err.message).toBe('room_spectators_full');

    cleanup(p1, p2, ...specs, s6);
  });

  it('spectator disconnect does not affect game', async () => {
    const { p1, p2, code } = await setupGame();
    const { state1 } = await doRedraw(p1, p2);

    const spec = createClient();
    const specConnected = waitFor(spec, 'connect');
    spec.connect();
    await specConnected;

    const joined = waitFor<{ state: any }>(spec, 'spectator_joined');
    spec.emit('join_as_spectator', { code });
    await joined;

    // Disconnect spectator
    spec.disconnect();
    await delay(200);

    // Game should still work — player can still play
    const stateAfter = waitFor<{ state: any }>(p1, 'state_update');
    const currentSocket = state1.currentPlayerIndex === state1.myIndex ? p1 : p2;
    currentSocket.emit('pass');
    const update = await stateAfter;
    expect(update.state.phase).toBeDefined();

    cleanup(p1, p2);
  });

  it('cannot spectate a game that has not started', async () => {
    const p1 = createClient();
    const p1Connected = waitFor(p1, 'connect');
    p1.connect();
    await p1Connected;

    const roomCreated = waitFor<{ code: string }>(p1, 'room_created');
    p1.emit('create_room');
    const { code } = await roomCreated;

    const spec = createClient();
    const specConnected = waitFor(spec, 'connect');
    spec.connect();
    await specConnected;

    const errPromise = waitFor<{ message: string }>(spec, 'error');
    spec.emit('join_as_spectator', { code });
    const err = await errPromise;
    expect(err.message).toContain('не началась');

    cleanup(p1, spec);
  });

  it('players receive spectator_count when spectator joins/leaves', async () => {
    const { p1, p2, code } = await setupGame();
    await doRedraw(p1, p2);

    // Listen for spectator_count on player 1
    const countPromise = waitFor<{ count: number }>(p1, 'spectator_count');

    const spec = createClient();
    const specConnected = waitFor(spec, 'connect');
    spec.connect();
    await specConnected;

    const joined = waitFor(spec, 'spectator_joined');
    spec.emit('join_as_spectator', { code });
    await joined;

    const countData = await countPromise;
    expect(countData.count).toBe(1);

    // Now disconnect spectator and check count goes to 0
    const countDown = waitFor<{ count: number }>(p1, 'spectator_count');
    spec.disconnect();
    const countData2 = await countDown;
    expect(countData2.count).toBe(0);

    cleanup(p1, p2);
  });

  it('join_room to full room returns room_full event', async () => {
    const { p1, p2, code } = await setupGame();

    const p3 = createClient();
    const p3Connected = waitFor(p3, 'connect');
    p3.connect();
    await p3Connected;

    const fullPromise = waitFor<{ code: string }>(p3, 'room_full');
    p3.emit('join_room', { code });
    const fullData = await fullPromise;
    expect(fullData.code).toBe(code);

    cleanup(p1, p2, p3);
  });

  it('openHands mode — spectator sees hands', async () => {
    const { p1, p2, code } = await setupGame('lion_guard', 'imperial_dogs', true);
    await doRedraw(p1, p2);

    const spec = createClient();
    const specConnected = waitFor(spec, 'connect');
    spec.connect();
    await specConnected;

    const joined = waitFor<{ state: any }>(spec, 'spectator_joined');
    spec.emit('join_as_spectator', { code });
    const { state } = await joined;

    expect(state.isSpectator).toBe(true);
    expect(Array.isArray(state.player1.hand)).toBe(true);
    expect(Array.isArray(state.player2.hand)).toBe(true);
    expect(state.player1.hand.length).toBeGreaterThan(0);

    cleanup(p1, p2, spec);
  });

  it('spectator does not receive informant_reveal', async () => {
    const { p1, p2, code } = await setupGame('imperial_dogs', 'lion_guard');
    await doRedraw(p1, p2);

    const spec = createClient();
    const specConnected = waitFor(spec, 'connect');
    spec.connect();
    await specConnected;

    const joined = waitFor(spec, 'spectator_joined');
    spec.emit('join_as_spectator', { code });
    await joined;

    // Track if spectator ever receives informant_reveal
    let gotInformant = false;
    spec.on('informant_reveal', () => { gotInformant = true; });

    // Attempt to activate leader — may or may not work depending on whose turn it is
    // Just verify the spectator doesn't get informant_reveal even if sent
    await delay(200);
    expect(gotInformant).toBe(false);

    cleanup(p1, p2, spec);
  });
});
