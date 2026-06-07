import { Server, Socket } from 'socket.io';
import { RoomManager } from '../rooms/manager.js';
import { GameEngine } from '../game/engine.js';
import { FactionId, CardRow, ClientToServerEvents, ServerToClientEvents, LeaderAbilityId, Room, SpectatorGameState, GameState, VALID_EMOTE_IDS } from '../types.js';
import { factions } from '../game/factions.js';
import { gameLog, validateStateInvariants } from '../utils/logger.js';

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const DISCONNECT_TIMEOUT_MS = 30_000;

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

export function setupSocketHandlers(io: IOServer, roomManager: RoomManager): void {
  const engine = new GameEngine();
  const factionSelections = new Map<string, Set<number>>();

  io.on('connection', (socket: IOSocket) => {
    log(`Socket connected: ${socket.id}`);

    // --- CREATE ROOM ---
    socket.on('create_room', (data) => {
      const openHands = data?.openHands ?? false;
      const room = roomManager.createRoom(socket.id, openHands);
      socket.join(room.code);
      socket.emit('room_created', { code: room.code });
      log(`Room ${room.code} created by ${socket.id} (openHands=${openHands})`);
    });

    // --- JOIN ROOM ---
    socket.on('join_room', ({ code }) => {
      // Check if room exists and is full → offer spectator mode
      const existing = roomManager.getRoom(code);
      if (existing && existing.playerSockets.length >= 2) {
        socket.emit('room_full', { code: existing.code });
        return;
      }

      const room = roomManager.joinRoom(code, socket.id);
      if (!room) {
        socket.emit('error', { message: 'Невозможно присоединиться: неверный код' });
        return;
      }
      socket.join(room.code);
      io.to(room.code).emit('player_joined', {});
      log(`Player ${socket.id} joined room ${room.code}`);
    });

    // --- JOIN AS SPECTATOR ---
    socket.on('join_as_spectator', ({ code }) => {
      const result = roomManager.joinAsSpectator(code, socket.id);
      if ('error' in result) {
        socket.emit('error', { message: result.error });
        return;
      }
      const room = result.room;
      socket.join(room.code);
      const spectatorState = getSpectatorState(room, engine);
      socket.emit('spectator_joined', { state: spectatorState });
      // Notify players about spectator count
      broadcastSpectatorCount(io, room);
      log(`Spectator ${socket.id} joined room ${room.code} (${room.spectatorSockets.length} spectators)`);
    });

    // --- SELECT FACTION ---
    socket.on('select_faction', ({ faction }) => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room || room.gameState.phase !== 'faction_select') {
        socket.emit('error', { message: 'Сейчас нельзя выбирать фракцию' });
        return;
      }

      const playerIndex = room.playerSockets.indexOf(socket.id);
      if (playerIndex === -1) return;

      room.gameState.players[playerIndex].faction = faction;
      io.to(room.code).emit('faction_selected', { playerIndex, faction });
      log(`Player ${playerIndex} selected faction: ${faction}`);

      // Track which players have selected
      if (!factionSelections.has(room.code)) factionSelections.set(room.code, new Set());
      factionSelections.get(room.code)!.add(playerIndex);

      // Если оба выбрали — стартуем
      if (factionSelections.get(room.code)!.size === 2) {
        factionSelections.delete(room.code);
        room.gameState = engine.startGame(room.gameState);
        validateStateInvariants('startGame', room.gameState, room.code);
        for (let i = 0; i < 2; i++) {
          const sid = room.playerSockets[i];
          io.to(sid).emit('game_started', {
            state: engine.getVisibleState(room.gameState, i),
          });
        }
        gameLog(room.code, `Game started: P0=${room.gameState.players[0].faction} vs P1=${room.gameState.players[1].faction}`);
      }
    });

    // --- REDRAW CARDS ---
    socket.on('redraw_cards', ({ cardIds }) => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;

      const playerIndex = room.playerSockets.indexOf(socket.id);
      if (playerIndex === -1) return;

      room.gameState = engine.redrawCards(room.gameState, playerIndex, cardIds);
      validateStateInvariants('redrawCards', room.gameState, room.code);
      gameLog(room.code, `[P${playerIndex}] redraw ${cardIds.length} cards`);

      // Если партизаны должны выбрать — промпт
      if (room.gameState.partisansPending) {
        const pIdx = engine.getPartisansPlayerIndex(room.gameState);
        if (pIdx !== -1) {
          io.to(room.playerSockets[pIdx]).emit('partisans_prompt', {});
        }
      }

      emitStateToAll(io, room, engine);
    });

    // --- PARTISANS FIRST ---
    socket.on('partisans_first', ({ goFirst }) => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room || !room.gameState.partisansPending) return;

      const playerIndex = room.playerSockets.indexOf(socket.id);
      const pIdx = engine.getPartisansPlayerIndex(room.gameState);
      if (playerIndex !== pIdx) return;

      room.gameState = engine.setPartisansFirst(room.gameState, goFirst);
      emitStateToAll(io, room, engine);
    });

    // --- PLAY CARD ---
    socket.on('play_card', ({ cardId, targetRow }) => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;

      const playerIndex = room.playerSockets.indexOf(socket.id);
      if (playerIndex === -1) return;

      const result = engine.playCard(room.gameState, playerIndex, cardId, targetRow);

      if (result.error) {
        socket.emit('error', { message: result.error });
        // Отправляем актуальное состояние, чтобы клиент сбросил isProcessing
        // и не остался залоченным после неудачной попытки сыграть карту.
        socket.emit('state_update', {
          state: engine.getVisibleState(room.gameState, playerIndex),
        });
        return;
      }

      room.gameState = result.state;
      validateStateInvariants('playCard', room.gameState, room.code);

      if (result.pendingChoice && result.pendingChoice.length > 0) {
        io.to(socket.id).emit('medic_prompt', { cards: result.pendingChoice });
      }

      checkRoundAndGameEnd(io, room, engine);
      emitStateToAll(io, room, engine);
      gameLog(room.code, `[P${playerIndex}] play_card: ${cardId}`);
    });

    // --- MEDIC CHOICE ---
    socket.on('medic_choice', ({ cardId }) => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;

      const playerIndex = room.playerSockets.indexOf(socket.id);
      if (playerIndex === -1) return;

      room.gameState = engine.resolveMedicChoice(room.gameState, playerIndex, cardId);
      validateStateInvariants('medicChoice', room.gameState, room.code);
      gameLog(room.code, `[P${playerIndex}] medic_choice: ${cardId}`);
      emitStateToAll(io, room, engine);
    });

    // --- PASS ---
    socket.on('pass', () => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;

      const playerIndex = room.playerSockets.indexOf(socket.id);
      if (playerIndex === -1) return;

      room.gameState = engine.pass(room.gameState, playerIndex);
      validateStateInvariants('pass', room.gameState, room.code);
      gameLog(room.code, `[P${playerIndex}] pass`);

      // Если партизаны должны выбрать после нового раунда
      if (room.gameState.partisansPending) {
        const pIdx = engine.getPartisansPlayerIndex(room.gameState);
        if (pIdx !== -1) {
          io.to(room.playerSockets[pIdx]).emit('partisans_prompt', {});
        }
      }

      checkRoundAndGameEnd(io, room, engine);
      emitStateToAll(io, room, engine);
    });

    // --- ACTIVATE LEADER ---
    socket.on('activate_leader', ({ targetRow }) => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;

      const playerIndex = room.playerSockets.indexOf(socket.id);
      if (playerIndex === -1) return;

      const result = engine.activateLeader(room.gameState, playerIndex, { targetRow });

      if (result.error) {
        socket.emit('error', { message: result.error });
        socket.emit('state_update', {
          state: engine.getVisibleState(room.gameState, playerIndex),
        });
        return;
      }

      room.gameState = result.state;
      validateStateInvariants('activateLeader', room.gameState, room.code);
      const faction = room.gameState.players[playerIndex].faction;
      const abilityId = factions[faction].leader.abilityId;
      gameLog(room.code, `[LEADER] P${playerIndex} activates ${abilityId}`);

      io.to(room.code).emit('leader_activated', { playerIndex, abilityId });

      if (result.pendingAction === 'informant_choice' && result.informantCards) {
        io.to(socket.id).emit('informant_reveal', { cards: result.informantCards });
      }

      if (result.pendingAction === 'roots_move') {
        io.to(socket.id).emit('roots_prompt', {});
      }

      checkRoundAndGameEnd(io, room, engine);
      emitStateToAll(io, room, engine);
    });

    // --- INFORMANT CHOICE ---
    socket.on('informant_choice', ({ cardId }) => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;

      const playerIndex = room.playerSockets.indexOf(socket.id);
      if (playerIndex === -1) return;

      const result = engine.resolveInformant(room.gameState, playerIndex, cardId);

      if (result.error) {
        socket.emit('error', { message: result.error });
        socket.emit('state_update', {
          state: engine.getVisibleState(room.gameState, playerIndex),
        });
        return;
      }

      room.gameState = result.state;
      emitStateToAll(io, room, engine);
    });

    // --- ROOTS MOVE ---
    socket.on('roots_move', ({ moves }) => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;

      const playerIndex = room.playerSockets.indexOf(socket.id);
      if (playerIndex === -1) return;

      const result = engine.resolveRoots(room.gameState, playerIndex, moves);

      if (result.error) {
        socket.emit('error', { message: result.error });
        socket.emit('state_update', {
          state: engine.getVisibleState(room.gameState, playerIndex),
        });
        return;
      }

      room.gameState = result.state;
      emitStateToAll(io, room, engine);
    });

    // --- RECONNECT ---
    socket.on('reconnect', ({ code }) => {
      const room = roomManager.getRoom(code);
      if (!room) {
        socket.emit('error', { message: 'Комната не найдена' });
        return;
      }

      const disconnectedIdx = room.playerSockets.findIndex(sid => {
        return !io.sockets.sockets.has(sid);
      });

      if (disconnectedIdx === -1) {
        socket.emit('error', { message: 'Нет отключившегося игрока для подмены' });
        return;
      }

      const oldId = room.playerSockets[disconnectedIdx];
      const reconnected = roomManager.reconnect(code, oldId, socket.id);
      if (!reconnected) {
        socket.emit('error', { message: 'Не удалось переподключиться' });
        return;
      }

      socket.join(code);
      emitStateToAll(io, reconnected, engine);
      broadcastToSpectators(io, reconnected, 'player_reconnected', { playerIndex: disconnectedIdx });
      log(`Player reconnected to room ${code}: ${oldId} -> ${socket.id}`);
    });

    // --- SEND EMOTE ---
    socket.on('send_emote', ({ emoteId }) => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;

      const playerIndex = room.playerSockets.indexOf(socket.id);
      if (playerIndex === -1) return; // Spectators cannot send emotes

      // Validate emoteId
      if (!VALID_EMOTE_IDS.includes(emoteId)) return;

      // Anti-spam: max 1 emote per 3 seconds per player
      const now = Date.now();
      if (!room.lastEmote) room.lastEmote = {};
      if (room.lastEmote[playerIndex] && now - room.lastEmote[playerIndex] < 3000) return;
      room.lastEmote[playerIndex] = now;

      const faction = room.gameState.players[playerIndex].faction;
      const emoteEvent = { playerIndex: playerIndex as 0 | 1, emoteId, faction };

      // Broadcast to both players
      for (const sid of room.playerSockets) {
        io.to(sid).emit('emote', emoteEvent);
      }
      // Broadcast to spectators
      for (const sid of room.spectatorSockets) {
        io.to(sid).emit('emote', emoteEvent);
      }
    });

    // --- DISCONNECT ---
    socket.on('disconnect', () => {
      log(`Socket disconnected: ${socket.id}`);

      // Check if spectator
      const specRoom = roomManager.removeSpectator(socket.id);
      if (specRoom) {
        broadcastSpectatorCount(io, specRoom);
        log(`Spectator ${socket.id} left room ${specRoom.code} (${specRoom.spectatorSockets.length} spectators)`);
        return;
      }

      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;

      const playerIndex = room.playerSockets.indexOf(socket.id);
      if (playerIndex === -1) return;

      const opponentIdx = playerIndex === 0 ? 1 : 0;
      if (room.playerSockets[opponentIdx]) {
        io.to(room.playerSockets[opponentIdx]).emit('opponent_disconnected', {});
      }

      // Notify spectators about player disconnect
      broadcastToSpectators(io, room, 'player_disconnected', { playerIndex });

      const timer = setTimeout(() => {
        room.gameState.log.push(`Player ${playerIndex} disconnect timeout — auto-pass`);
        if (room.gameState.phase === 'playing' && !room.gameState.players[playerIndex].passed) {
          room.gameState = engine.pass(room.gameState, playerIndex);
          checkRoundAndGameEnd(io, room, engine);
          emitStateToAll(io, room, engine);
        }
      }, DISCONNECT_TIMEOUT_MS);

      room.disconnectTimers.set(socket.id, timer);
    });
  });
}

function emitStateToAll(
  io: IOServer,
  room: NonNullable<ReturnType<RoomManager['getRoom']>>,
  engine: GameEngine
): void {
  for (let i = 0; i < room.playerSockets.length; i++) {
    const sid = room.playerSockets[i];
    io.to(sid).emit('state_update', {
      state: engine.getVisibleState(room.gameState, i),
    });
  }
  // Broadcast to spectators
  if (room.spectatorSockets.length > 0) {
    const spectatorState = getSpectatorState(room, engine);
    for (const sid of room.spectatorSockets) {
      io.to(sid).emit('state_update', { state: spectatorState });
    }
  }
}

function checkRoundAndGameEnd(
  io: IOServer,
  room: NonNullable<ReturnType<RoomManager['getRoom']>>,
  engine: GameEngine
): void {
  const state = room.gameState;
  if (state.phase === 'game_over') {
    const winner = engine.getWinner(state);
    const finalScore = engine.getFinalScore(state);
    io.to(room.code).emit('game_over', { winner, finalScore });
    gameLog(room.code, `[GAME OVER] winner=P${winner}, score=${finalScore[0]}-${finalScore[1]}`);
  }
}

function getSpectatorState(room: Room, engine: GameEngine): SpectatorGameState {
  const state = room.gameState;
  const p0 = state.players[0];
  const p1 = state.players[1];
  const f0 = factions[p0.faction];
  const f1 = factions[p1.faction];

  const makeView = (p: typeof p0, f: typeof f0) => ({
    faction: p.faction,
    handCount: p.hand.length,
    ...(room.openHands ? { hand: [...p.hand] } : {}),
    deckCount: p.deck.length,
    discard: [...p.discard],
    passed: p.passed,
    roundsWon: p.roundsWon,
    leaderUsed: p.leaderUsed,
    leaderAbility: f.leader.ability,
    field: p.field,
    hornActive: p.hornActive,
  });

  return {
    id: state.id,
    phase: state.phase,
    currentPlayerIndex: state.currentPlayerIndex,
    round: state.round,
    weather: { ...state.weather },
    player1: makeView(p0, f0),
    player2: makeView(p1, f1),
    strength: {
      player1: {
        melee: engine.calculateRowStrength(p0.field.melee, state.weather.frost, p0.hornActive.melee),
        ranged: engine.calculateRowStrength(p0.field.ranged, state.weather.fog, p0.hornActive.ranged),
        siege: engine.calculateRowStrength(p0.field.siege, state.weather.rain, p0.hornActive.siege),
        total: engine.calculatePlayerStrength(p0, state.weather),
      },
      player2: {
        melee: engine.calculateRowStrength(p1.field.melee, state.weather.frost, p1.hornActive.melee),
        ranged: engine.calculateRowStrength(p1.field.ranged, state.weather.fog, p1.hornActive.ranged),
        siege: engine.calculateRowStrength(p1.field.siege, state.weather.rain, p1.hornActive.siege),
        total: engine.calculatePlayerStrength(p1, state.weather),
      },
    },
    log: state.log.slice(-20),
    isSpectator: true,
  };
}

function broadcastToSpectators(io: IOServer, room: Room, event: string, data: unknown): void {
  for (const sid of room.spectatorSockets) {
    (io.to(sid) as any).emit(event, data);
  }
}

function broadcastSpectatorCount(io: IOServer, room: Room): void {
  const count = room.spectatorSockets.length;
  for (const sid of room.playerSockets) {
    io.to(sid).emit('spectator_count', { count });
  }
}
