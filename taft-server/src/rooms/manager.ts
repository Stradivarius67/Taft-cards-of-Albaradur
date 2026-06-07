import { Room, GameState, PlayerState, ArenaMutator } from '../types.js';

const MAX_SPECTATORS = 5;

const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 2 часа
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 минут

// Символы без путаницы (без 0/O/I/l)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
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

    const room: Room = {
      code,
      gameState,
      createdAt: Date.now(),
      playerSockets: [socketId],
      spectatorSockets: [],
      disconnectTimers: new Map(),
      openHands,
      mutator,
    };

    this.rooms.set(code, room);
    return room;
  }

  joinRoom(code: string, socketId: string): Room | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return null;
    if (room.playerSockets.length >= 2) return null;
    if (room.playerSockets.includes(socketId)) return null;

    room.playerSockets.push(socketId);
    room.gameState.players.push(this.createEmptyPlayer(socketId));
    room.gameState.phase = 'faction_select';
    room.gameState.log.push(`Player 2 joined (${socketId})`);
    return room;
  }

  joinAsSpectator(code: string, socketId: string): { room: Room } | { error: string } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return { error: 'Комната не найдена' };
    if (room.playerSockets.length < 2) return { error: 'Игра ещё не началась, подождите' };
    if (room.spectatorSockets.length >= MAX_SPECTATORS) return { error: 'room_spectators_full' };
    if (room.spectatorSockets.includes(socketId)) return { error: 'Вы уже наблюдаете' };
    room.spectatorSockets.push(socketId);
    return { room };
  }

  removeSpectator(socketId: string): Room | null {
    for (const room of this.rooms.values()) {
      const idx = room.spectatorSockets.indexOf(socketId);
      if (idx !== -1) {
        room.spectatorSockets.splice(idx, 1);
        return room;
      }
    }
    return null;
  }

  isSpectator(socketId: string): boolean {
    for (const room of this.rooms.values()) {
      if (room.spectatorSockets.includes(socketId)) return true;
    }
    return false;
  }

  getRoom(code: string): Room | null {
    return this.rooms.get(code.toUpperCase()) || null;
  }

  getRoomBySocket(socketId: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.playerSockets.includes(socketId) || room.spectatorSockets.includes(socketId)) {
        return room;
      }
    }
    return null;
  }

  deleteRoom(code: string): void {
    const room = this.rooms.get(code);
    if (room) {
      for (const timer of room.disconnectTimers.values()) {
        clearTimeout(timer);
      }
    }
    this.rooms.delete(code);
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * Reconnect: заменить старый socketId на новый
   */
  reconnect(code: string, oldSocketId: string, newSocketId: string): Room | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return null;

    const idx = room.playerSockets.indexOf(oldSocketId);
    if (idx === -1) return null;

    room.playerSockets[idx] = newSocketId;
    room.gameState.players[idx].id = newSocketId;

    // Отменяем таймер дисконнекта
    const timer = room.disconnectTimers.get(oldSocketId);
    if (timer) {
      clearTimeout(timer);
      room.disconnectTimers.delete(oldSocketId);
    }

    room.gameState.log.push(`Player ${idx} reconnected`);
    return room;
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
      if (now - room.createdAt > ROOM_TTL_MS) {
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
  }
}
