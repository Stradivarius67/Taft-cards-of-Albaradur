import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import express from 'express';
import { RoomManager } from '../../src/rooms/manager.js';
import { setupSocketHandlers } from '../../src/socket/handlers.js';

let httpServer: ReturnType<typeof createServer>;
let ioServer: Server;
let port: number;

function createClient(): ClientSocket {
  return ioClient(`http://localhost:${port}`, { autoConnect: false, transports: ['websocket'] });
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

/** Полный флоу до game_started с заданным мутатором. */
async function startWithMutator(mutator: string) {
  const p1 = createClient();
  const p2 = createClient();
  const c1 = waitFor(p1, 'connect');
  const c2 = waitFor(p2, 'connect');
  p1.connect();
  p2.connect();
  await Promise.all([c1, c2]);

  const created = waitFor<{ code: string }>(p1, 'room_created');
  p1.emit('create_room', { mutator });
  const { code } = await created;

  const joined = waitFor(p1, 'player_joined');
  p2.emit('join_room', { code });
  await joined;

  const gs1 = waitFor<{ state: any }>(p1, 'game_started');
  const gs2 = waitFor<{ state: any }>(p2, 'game_started');
  p1.emit('select_faction', { faction: 'lion_guard' });
  p2.emit('select_faction', { faction: 'imperial_dogs' });
  const [s1, s2] = await Promise.all([gs1, gs2]);

  p1.disconnect();
  p2.disconnect();
  return { state1: s1.state, state2: s2.state };
}

beforeAll(async () => {
  const app = express();
  httpServer = createServer(app);
  ioServer = new Server(httpServer, { cors: { origin: '*' } });
  setupSocketHandlers(ioServer, new RoomManager());
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

describe('Integration: Arena mutators', () => {
  it('grand_arsenal deals 11 cards and is reflected in visible state', async () => {
    const { state1, state2 } = await startWithMutator('grand_arsenal');
    expect(state1.mutator).toBe('grand_arsenal');
    expect(state2.mutator).toBe('grand_arsenal');
    expect(state1.me.hand.length).toBe(11);
    expect(state2.me.hand.length).toBe(11);
  });

  it('default (no mutator) deals 10 cards and reports none', async () => {
    const p1 = createClient();
    const p2 = createClient();
    const c1 = waitFor(p1, 'connect');
    const c2 = waitFor(p2, 'connect');
    p1.connect();
    p2.connect();
    await Promise.all([c1, c2]);

    const created = waitFor<{ code: string }>(p1, 'room_created');
    p1.emit('create_room'); // no payload at all
    const { code } = await created;
    const joined = waitFor(p1, 'player_joined');
    p2.emit('join_room', { code });
    await joined;
    const gs1 = waitFor<{ state: any }>(p1, 'game_started');
    p1.emit('select_faction', { faction: 'lion_guard' });
    p2.emit('select_faction', { faction: 'imperial_dogs' });
    const s1 = await gs1;

    expect(s1.state.mutator).toBe('none');
    expect(s1.state.me.hand.length).toBe(10);
    p1.disconnect();
    p2.disconnect();
  });

  it('invalid mutator id falls back to none', async () => {
    const { state1 } = await startWithMutator('totally_made_up');
    expect(state1.mutator).toBe('none');
    expect(state1.me.hand.length).toBe(10);
  });

  it('reinforcements is carried in visible state', async () => {
    const { state1 } = await startWithMutator('reinforcements');
    expect(state1.mutator).toBe('reinforcements');
  });
});
