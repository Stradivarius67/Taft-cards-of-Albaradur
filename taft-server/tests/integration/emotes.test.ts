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

async function setupGame(faction1 = 'lion_guard', faction2 = 'imperial_dogs') {
  const p1 = createClient();
  const p2 = createClient();

  const p1Connected = waitFor(p1, 'connect');
  const p2Connected = waitFor(p2, 'connect');
  p1.connect();
  p2.connect();
  await Promise.all([p1Connected, p2Connected]);

  const roomCreated = waitFor<{ code: string }>(p1, 'room_created');
  p1.emit('create_room');
  const { code } = await roomCreated;

  const playerJoined = waitFor(p1, 'player_joined');
  p2.emit('join_room', { code });
  await playerJoined;

  const gs1 = waitFor(p1, 'game_started');
  const gs2 = waitFor(p2, 'game_started');
  p1.emit('select_faction', { faction: faction1 });
  p2.emit('select_faction', { faction: faction2 });
  await Promise.all([gs1, gs2]);

  // redraw to reach playing phase
  const p1Playing = waitForState(p1, s => s.phase === 'playing');
  const p2Playing = waitForState(p2, s => s.phase === 'playing');
  p1.emit('redraw_cards', { cardIds: [] });
  p2.emit('redraw_cards', { cardIds: [] });
  await Promise.all([p1Playing, p2Playing]);

  return { p1, p2, code };
}

function cleanup(...sockets: ClientSocket[]) {
  sockets.forEach(s => s.disconnect());
}

describe('Integration: Emotes', () => {
  it('emote is delivered to both players', async () => {
    const { p1, p2 } = await setupGame();

    const p1Received = waitFor<any>(p1, 'emote');
    const p2Received = waitFor<any>(p2, 'emote');

    p1.emit('send_emote', { emoteId: 'greet' });

    const [e1, e2] = await Promise.all([p1Received, p2Received]);
    expect(e1.emoteId).toBe('greet');
    expect(e1.playerIndex).toBe(0);
    expect(e1.faction).toBe('lion_guard');
    expect(e2.emoteId).toBe('greet');
    expect(e2.playerIndex).toBe(0);

    cleanup(p1, p2);
  });

  it('emote is delivered to spectators', async () => {
    const { p1, p2, code } = await setupGame('lion_guard', 'grey_rangers');

    const spec = createClient();
    const specConnected = waitFor(spec, 'connect');
    spec.connect();
    await specConnected;

    const specJoined = waitFor(spec, 'spectator_joined');
    spec.emit('join_as_spectator', { code });
    await specJoined;

    const specReceived = waitFor<any>(spec, 'emote');
    p2.emit('send_emote', { emoteId: 'praise' });
    const event = await specReceived;
    expect(event.emoteId).toBe('praise');
    expect(event.playerIndex).toBe(1);
    expect(event.faction).toBe('grey_rangers');

    cleanup(p1, p2, spec);
  });

  it('spectator cannot send emotes', async () => {
    const { p1, p2, code } = await setupGame();

    const spec = createClient();
    const specConnected = waitFor(spec, 'connect');
    spec.connect();
    await specConnected;

    const specJoined = waitFor(spec, 'spectator_joined');
    spec.emit('join_as_spectator', { code });
    await specJoined;

    let receivedByPlayer = false;
    p1.once('emote', () => { receivedByPlayer = true; });

    spec.emit('send_emote', { emoteId: 'taunt' });
    await delay(200);

    expect(receivedByPlayer).toBe(false);

    cleanup(p1, p2, spec);
  });

  it('anti-spam: second emote within 3s is ignored', async () => {
    const { p1, p2 } = await setupGame();

    // First emote — delivered
    const first = waitFor<any>(p2, 'emote');
    p1.emit('send_emote', { emoteId: 'greet' });
    await first;

    // Second emote immediately — should be blocked
    let secondReceived = false;
    p2.once('emote', () => { secondReceived = true; });
    p1.emit('send_emote', { emoteId: 'thanks' });
    await delay(200);
    expect(secondReceived).toBe(false);

    cleanup(p1, p2);
  });

  it('invalid emoteId is ignored', async () => {
    const { p1, p2 } = await setupGame();

    let received = false;
    p2.once('emote', () => { received = true; });

    // @ts-expect-error - testing invalid emote id
    p1.emit('send_emote', { emoteId: 'not_a_real_emote' });
    await delay(200);
    expect(received).toBe(false);

    cleanup(p1, p2);
  });

  it('different players can send emotes independently (per-player cooldown)', async () => {
    const { p1, p2 } = await setupGame();

    const p1Ev = waitFor<any>(p1, 'emote');
    p1.emit('send_emote', { emoteId: 'greet' });
    const first = await p1Ev;
    expect(first.playerIndex).toBe(0);

    // p2 should still be able to send despite p1's recent emote
    const p2Ev = waitFor<any>(p1, 'emote');
    p2.emit('send_emote', { emoteId: 'thanks' });
    const second = await p2Ev;
    expect(second.playerIndex).toBe(1);

    cleanup(p1, p2);
  });
});
