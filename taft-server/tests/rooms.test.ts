import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RoomManager } from '../src/rooms/manager.js';

describe('RoomManager', () => {
  let manager: RoomManager;

  beforeEach(() => {
    manager = new RoomManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('createRoom', () => {
    it('should create room with 6-character code', () => {
      const room = manager.createRoom('socket1');
      expect(room.code.length).toBe(6);
      expect(room.playerSockets).toContain('socket1');
    });

    it('should not include confusing characters (0, O, I, l)', () => {
      for (let i = 0; i < 50; i++) {
        const room = manager.createRoom(`socket_${i}`);
        expect(room.code).not.toMatch(/[0OIl]/);
      }
    });

    it('should set phase to waiting', () => {
      const room = manager.createRoom('socket1');
      expect(room.gameState.phase).toBe('waiting');
    });

    it('should set default faction to lion_guard', () => {
      const room = manager.createRoom('socket1');
      expect(room.gameState.players[0].faction).toBe('lion_guard');
    });
  });

  describe('joinRoom', () => {
    it('should allow second player to join', () => {
      const room = manager.createRoom('socket1');
      const joined = manager.joinRoom(room.code, 'socket2');
      expect(joined).not.toBeNull();
      expect(joined!.playerSockets.length).toBe(2);
      expect(joined!.gameState.phase).toBe('faction_select');
    });

    it('should return null for non-existent room', () => {
      expect(manager.joinRoom('ZZZZZZ', 'socket1')).toBeNull();
    });

    it('should return null when room is full', () => {
      const room = manager.createRoom('socket1');
      manager.joinRoom(room.code, 'socket2');
      expect(manager.joinRoom(room.code, 'socket3')).toBeNull();
    });

    it('should not allow same player to join twice', () => {
      const room = manager.createRoom('socket1');
      expect(manager.joinRoom(room.code, 'socket1')).toBeNull();
    });
  });

  describe('getRoom', () => {
    it('should return room by code', () => {
      const created = manager.createRoom('socket1');
      const found = manager.getRoom(created.code);
      expect(found).not.toBeNull();
      expect(found!.code).toBe(created.code);
    });

    it('should be case-insensitive', () => {
      const created = manager.createRoom('socket1');
      expect(manager.getRoom(created.code.toLowerCase())).not.toBeNull();
    });
  });

  describe('getRoomBySocket', () => {
    it('should find room by socket id', () => {
      const room = manager.createRoom('socket1');
      const found = manager.getRoomBySocket('socket1');
      expect(found).not.toBeNull();
      expect(found!.code).toBe(room.code);
    });

    it('should return null for unknown socket', () => {
      expect(manager.getRoomBySocket('unknown')).toBeNull();
    });

    it('should index joined players and spectators', () => {
      const room = manager.createRoom('socket1');
      manager.joinRoom(room.code, 'socket2');
      manager.joinAsSpectator(room.code, 'spectator1');

      expect(manager.getRoomBySocket('socket2')?.code).toBe(room.code);
      expect(manager.getRoomBySocket('spectator1')?.code).toBe(room.code);
      expect(manager.isSpectator('spectator1')).toBe(true);
    });

    it('should remove spectators from the reverse index', () => {
      const room = manager.createRoom('socket1');
      manager.joinRoom(room.code, 'socket2');
      manager.joinAsSpectator(room.code, 'spectator1');

      expect(manager.removeSpectator('spectator1')?.code).toBe(room.code);
      expect(manager.getRoomBySocket('spectator1')).toBeNull();
      expect(manager.isSpectator('spectator1')).toBe(false);
    });
  });

  describe('deleteRoom', () => {
    it('should remove room', () => {
      const room = manager.createRoom('socket1');
      manager.joinRoom(room.code, 'socket2');
      manager.deleteRoom(room.code);
      expect(manager.getRoom(room.code)).toBeNull();
      expect(manager.getRoomBySocket('socket1')).toBeNull();
      expect(manager.getRoomBySocket('socket2')).toBeNull();
    });
  });

  describe('reconnect', () => {
    it('should replace the socket in the reverse index', () => {
      const room = manager.createRoom('socket1');
      manager.joinRoom(room.code, 'socket2');

      const resumeToken = manager.getResumeToken(room, 1)!;
      expect(manager.reconnect(room.code, resumeToken, 'socket2-new')).not.toBeNull();
      expect(manager.getRoomBySocket('socket2')).toBeNull();
      expect(manager.getRoomBySocket('socket2-new')?.code).toBe(room.code);
      expect(manager.getResumeToken(room, 1)).not.toBe(resumeToken);
    });

    it('accepts the previous token briefly when renewed credentials were not delivered', () => {
      const room = manager.createRoom('socket1');
      manager.joinRoom(room.code, 'socket2');

      const resumeToken = manager.getResumeToken(room, 1)!;
      manager.reconnect(room.code, resumeToken, 'socket2-new');
      const renewedToken = manager.getResumeToken(room, 1)!;

      expect(manager.reconnect(room.code, resumeToken, 'socket2-retry')).toBe(room);
      expect(manager.getResumeToken(room, 1)).toBe(renewedToken);
      expect(manager.getRoomBySocket('socket2-new')).toBeNull();
      expect(manager.getRoomBySocket('socket2-retry')).toBe(room);
    });

    it('should reject an invalid resume token', () => {
      const room = manager.createRoom('socket1');
      manager.joinRoom(room.code, 'socket2');

      expect(manager.reconnect(room.code, 'invalid-token', 'attacker')).toBeNull();
      expect(manager.getRoomBySocket('attacker')).toBeNull();
      expect(manager.getRoomBySocket('socket2')?.code).toBe(room.code);
    });

    it('should reject a reconnect from a socket already assigned to a room', () => {
      const room = manager.createRoom('socket1');
      manager.joinRoom(room.code, 'socket2');
      const otherRoom = manager.createRoom('already-assigned');
      const resumeToken = manager.getResumeToken(room, 1)!;

      expect(manager.reconnect(room.code, resumeToken, 'already-assigned')).toBeNull();
      expect(manager.getRoomBySocket('already-assigned')).toBe(otherRoom);
    });
  });

  describe('getRoomCount', () => {
    it('should track room count', () => {
      expect(manager.getRoomCount()).toBe(0);
      manager.createRoom('s1');
      expect(manager.getRoomCount()).toBe(1);
      manager.createRoom('s2');
      expect(manager.getRoomCount()).toBe(2);
    });
  });
});
