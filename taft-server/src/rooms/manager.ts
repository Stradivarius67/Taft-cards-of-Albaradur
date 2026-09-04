import { Room, GameState, PlayerState, ArenaMutator } from '../types.js';
import { randomBytes } from 'node:crypto';

const MAX_SPECTATORS = 5;

const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 2 часа
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 минут
const PREVIOUS_TOKEN_GRACE_MS = 60_000;

// Символы без путаницы (без 0/O/I/l)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

function generateResumeToken(): string {
  return randomBytes(24).toString('base64url');
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  /**
   * Reverse index for the hottest lookup in socket handlers. A socket belongs
   * to at most one game room, so resolving it must not scan every active room.
   */
  private socketRooms = new Map<string, string>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
  }

  createRoom(socketId: string, openHands = false, mutator: ArenaMutator = 'none'): Room {
    let code: string;
    do {
      code = generateCode();
    } while (this.rooms.has(code));

    const gameState: GameState = {
      id: code,
      phase: 'waiting',
      players: [this.createEmptyPlayer(socketId)],
      currentPlayerIndex: 0,
      round: 1,
      weather: { frost: false, fog: false, rain: false },
      mutator,
      log: [`Room ${code} created`],
      redrawsDone: [],
    };

    const now = Date.now();
    const room: Room = {
      code,
      gameState,
      createdAt: now,
      lastActivityAt: now,
      playerSockets: [socketId],
      playerTokens: [generateResumeToken()],
      previousPlayerTokens: [null],
      spectatorSockets: [],
      disconnectTimers: new Map(),
      timedOutPlayers: new Set(),
      factionSelections: new Set(),
      openHands,
      mutator,
    };

    this.rooms.set(code, room);
    this.socketRooms.set(socketId, code);
    return room;
  }

  joinRoom(code: string, socketId: string): Room | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return null;
    if (this.socketRooms.has(socketId)) return null;
    if (room.playerSockets.length >= 2) return null;

    room.playerSockets.push(socketId);
    room.playerTokens.push(generateResumeToken());
    room.previousPlayerTokens.push(null);
    this.socketRooms.set(socketId, room.code);
    room.gameState.players.push(this.createEmptyPlayer(socketId));
    room.gameState.phase = 'faction_select';
    room.gameState.log.push(`Player 2 joined (${socketId})`);
    room.lastActivityAt = Date.now();
    return room;
  }

  joinAsSpectator(code: string, socketId: string): { room: Room } | { error: string } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return { error: 'Комната не найдена' };
    if (this.socketRooms.has(socketId)) return { error: 'Вы уже находитесь в комнате' };
    if (room.playerSockets.length < 2) return { error: 'Игра ещё не началась, подождите' };
    if (room.spectatorSockets.length >= MAX_SPECTATORS) return { error: 'room_spectators_full' };
    room.spectatorSockets.push(socketId);
    this.socketRooms.set(socketId, room.code);
    room.lastActivityAt = Date.now();
    return { room };
  }

  removeSpectator(socketId: string): Room | null {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;

    const idx = room.spectatorSockets.indexOf(socketId);
    if (idx === -1) return null;

    room.spectatorSockets.splice(idx, 1);
    this.socketRooms.delete(socketId);
    return room;
  }

  isSpectator(socketId: string): boolean {
    const room = this.getRoomBySocket(socketId);
    return room?.spectatorSockets.includes(socketId) ?? false;
  }

  getRoom(code: string): Room | null {
    return this.rooms.get(code.toUpperCase()) || null;
  }

  getRoomBySocket(socketId: string): Room | null {
    const code = this.socketRooms.get(socketId);
    const room = code ? this.rooms.get(code) ?? null : null;
    if (room) room.lastActivityAt = Date.now();
    return room;
  }

  deleteRoom(code: string): void {
    const normalizedCode = code.toUpperCase();
    const room = this.rooms.get(normalizedCode);
    if (room) {
      for (const timer of room.disconnectTimers.values()) {
        clearTimeout(timer);
      }
      for (const socketId of [...room.playerSockets, ...room.spectatorSockets]) {
        this.socketRooms.delete(socketId);
      }
    }
    this.rooms.delete(normalizedCode);
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  hasSocket(socketId: string): boolean {
    return this.socketRooms.has(socketId);
  }

  /**
   * Reconnect: заменить старый socketId на новый
   */
  reconnect(code: string, resumeToken: string, newSocketId: string): Room | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return null;
    if (this.socketRooms.has(newSocketId)) return null;

    const idx = this.getPlayerIndexForResumeToken(room, resumeToken);
    if (idx === -1) return null;

    const oldSocketId = room.playerSockets[idx];

    room.playerSockets[idx] = newSocketId;
    // Rotate a current credential, but keep a brief one-token grace window in
    // case the connection drops before session_ready reaches the browser.
    if (room.playerTokens[idx] === resumeToken) {
      room.previousPlayerTokens[idx] = {
        token: resumeToken,
        expiresAt: Date.now() + PREVIOUS_TOKEN_GRACE_MS,
      };
      room.playerTokens[idx] = generateResumeToken();
    }
    room.gameState.players[idx].id = newSocketId;
    this.socketRooms.delete(oldSocketId);
    this.socketRooms.set(newSocketId, room.code);
    room.lastActivityAt = Date.now();
    room.timedOutPlayers.delete(idx);

    // Отменяем таймер дисконнекта
    const timer = room.disconnectTimers.get(oldSocketId);
    if (timer) {
      clearTimeout(timer);
      room.disconnectTimers.delete(oldSocketId);
    }

    room.gameState.log.push(`Player ${idx} reconnected`);
    return room;
  }

  getResumeToken(room: Room, playerIndex: number): string | null {
    return room.playerTokens[playerIndex] ?? null;
  }

  getPlayerIndexForResumeToken(room: Room, resumeToken: string): number {
    const currentIndex = room.playerTokens.indexOf(resumeToken);
    if (currentIndex !== -1) return currentIndex;

    const now = Date.now();
    return room.previousPlayerTokens.findIndex(previous => (
      previous?.token === resumeToken && previous.expiresAt > now
    ));
  }

  private createEmptyPlayer(socketId: string): PlayerState {
    return {
      id: socketId,
      faction: 'lion_guard', // default, will be changed on select
      hand: [],
      deck: [],
      discard: [],
      passed: false,
      roundsWon: 0,
      field: { melee: [], ranged: [], siege: [] },
      hornActive: { melee: false, ranged: false, siege: false },
      leaderUsed: false,
    };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (now - room.lastActivityAt > ROOM_TTL_MS) {
        this.deleteRoom(code);
        console.log(`[${new Date().toISOString()}] Room ${code} expired and removed`);
      }
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    for (const room of this.rooms.values()) {
      for (const timer of room.disconnectTimers.values()) {
        clearTimeout(timer);
      }
      room.disconnectTimers.clear();
    }
    this.rooms.clear();
    this.socketRooms.clear();
  }
}
