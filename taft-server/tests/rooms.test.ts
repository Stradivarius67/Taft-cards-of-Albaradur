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
  });

  describe('deleteRoom', () => {
    it('should remove room', () => {
      const room = manager.createRoom('socket1');
      manager.deleteRoom(room.code);
      expect(manager.getRoom(room.code)).toBeNull();
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
