import { Server, Socket } from 'socket.io';
import { RoomManager } from '../rooms/manager.js';
import { GameEngine } from '../game/engine.js';
import { FactionId, CardRow, ClientToServerEvents, ServerToClientEvents, LeaderAbilityId, Room, SpectatorGameState, GameState, VALID_EMOTE_IDS } from '../types.js';
import { factions } from '../game/factions.js';
import { normalizeMutator } from '../game/mutators.js';
import { gameLog, validateStateInvariants } from '../utils/logger.js';

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const DISCONNECT_TIMEOUT_MS = 30_000;
const CARD_ROWS = new Set<CardRow>(['melee', 'ranged', 'siege']);

function isFactionId(value: unknown): value is FactionId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(factions, value);
}

function isCardRow(value: unknown): value is CardRow {
  return typeof value === 'string' && CARD_ROWS.has(value as CardRow);
}

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

export function setupSocketHandlers(io: IOServer, roomManager: RoomManager): void {
  const engine = new GameEngine();

  io.on('connection', (socket: IOSocket) => {
    log(`Socket connected: ${socket.id}`);

    const safeOn = <Event extends keyof ClientToServerEvents>(
      event: Event,
      handler: ClientToServerEvents[Event]
    ): void => {
      socket.on(event, ((...args: unknown[]) => {
        try {
          (handler as (...handlerArgs: unknown[]) => void)(...args);
        } catch (error) {
          log(`Rejected malformed ${String(event)} from ${socket.id}: ${error instanceof Error ? error.message : String(error)}`);
          socket.emit('error', { message: 'Некорректные данные запроса' });
        }
      }) as never);
    };

    // --- CREATE ROOM ---
    safeOn('create_room', (data) => {
      if (roomManager.hasSocket(socket.id)) {
        socket.emit('error', { message: 'Вы уже находитесь в комнате' });
        return;
      }
      const openHands = data?.openHands === true;
      const mutator = normalizeMutator(data?.mutator);
      const room = roomManager.createRoom(socket.id, openHands, mutator);
      socket.join(room.code);
      socket.emit('room_created', { code: room.code });
      socket.emit('session_ready', {
        code: room.code,
        resumeToken: roomManager.getResumeToken(room, 0)!,
      });
      log(`Room ${room.code} created by ${socket.id} (openHands=${openHands}, mutator=${mutator})`);
    });

    // --- JOIN ROOM ---
    safeOn('join_room', ({ code }) => {
      if (typeof code !== 'string') throw new TypeError('code must be a string');
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
      const playerIndex = room.playerSockets.indexOf(socket.id);
      socket.emit('session_ready', {
        code: room.code,
        resumeToken: roomManager.getResumeToken(room, playerIndex)!,
      });
      io.to(room.code).emit('player_joined', {});
      log(`Player ${socket.id} joined room ${room.code}`);
    });

    // --- JOIN AS SPECTATOR ---
    safeOn('join_as_spectator', ({ code }) => {
      if (typeof code !== 'string') throw new TypeError('code must be a string');
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
    safeOn('select_faction', ({ faction }) => {
      if (!isFactionId(faction)) {
        socket.emit('error', { message: 'Неизвестная фракция' });
        return;
      }
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room || room.gameState.phase !== 'faction_select') {
        socket.emit('error', { message: 'Сейчас нельзя выбирать фракцию' });
        return;
      }

      const playerIndex = room.playerSockets.indexOf(socket.id);
      if (playerIndex === -1) return;

      room.gameState.players[playerIndex].faction = faction;
      const opponentIndex = playerIndex === 0 ? 1 : 0;
      const opponentSocket = room.playerSockets[opponentIndex];
      if (opponentSocket) io.to(opponentSocket).emit('faction_selected', { playerIndex, faction });
      log(`Player ${playerIndex} selected faction: ${faction}`);

      // Track which players have selected
      room.factionSelections.add(playerIndex);

      // Если оба выбрали — стартуем
      if (room.factionSelections.size === 2) {
        room.factionSelections.clear();
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
    safeOn('redraw_cards', ({ cardIds }) => {
      if (!Array.isArray(cardIds) || cardIds.length > 2 || cardIds.some(id => typeof id !== 'string')) {
        socket.emit('error', { message: 'Некорректный список карт для замены' });
        const room = roomManager.getRoomBySocket(socket.id);
        const playerIndex = room?.playerSockets.indexOf(socket.id) ?? -1;
        if (room && playerIndex !== -1) {
          socket.emit('state_update', { state: engine.getVisibleState(room.gameState, playerIndex) });
        }
        return;
      }
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;

      const playerIndex = room.playerSockets.indexOf(socket.id);
      if (playerIndex === -1) return;

      room.gameState = engine.redrawCards(room.gameState, playerIndex, cardIds);
      validateStateInvariants('redrawCards', room.gameState, room.code);
      gameLog(room.code, `[P${playerIndex}] redraw ${cardIds.length} cards`);

      settleTimedOutPlayers(room, engine);
      checkRoundAndGameEnd(io, room, engine);

      emitStateToAll(io, room, engine);
    });

    // --- PARTISANS FIRST ---
    safeOn('partisans_first', ({ goFirst }) => {
      if (typeof goFirst !== 'boolean') return;
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room || !room.gameState.partisansPending) return;

      const playerIndex = room.playerSockets.indexOf(socket.id);
      const pIdx = engine.getPartisansPlayerIndex(room.gameState);
      if (playerIndex !== pIdx) return;

      room.gameState = engine.setPartisansFirst(room.gameState, goFirst);
      settleTimedOutPlayers(room, engine);
      checkRoundAndGameEnd(io, room, engine);
      emitStateToAll(io, room, engine);
    });

    // --- PLAY CARD ---
    safeOn('play_card', ({ cardId, targetRow }) => {
      if (typeof cardId !== 'string' || cardId.length > 100 || (targetRow !== undefined && (typeof targetRow !== 'string' || targetRow.length > 100))) {
        socket.emit('error', { message: 'Некорректные данные карты' });
        return;
      }
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

      settleTimedOutPlayers(room, engine);
      checkRoundAndGameEnd(io, room, engine);
      emitStateToAll(io, room, engine);
      gameLog(room.code, `[P${playerIndex}] play_card: ${cardId}`);
    });

    // --- MEDIC CHOICE ---
    safeOn('medic_choice', ({ cardId }) => {
      if (cardId !== null && typeof cardId !== 'string') return;
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;

      const playerIndex = room.playerSockets.indexOf(socket.id);
      if (playerIndex === -1) return;

      const result = engine.resolveMedicChoice(room.gameState, playerIndex, cardId);
      if (result.error) {
        socket.emit('error', { message: result.error });
        return;
      }
      room.gameState = result.state;
      validateStateInvariants('medicChoice', room.gameState, room.code);
      gameLog(room.code, `[P${playerIndex}] medic_choice: ${cardId}`);
      settleTimedOutPlayers(room, engine);
      checkRoundAndGameEnd(io, room, engine);
      emitStateToAll(io, room, engine);
    });

    // --- PASS ---
    safeOn('pass', () => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;

      const playerIndex = room.playerSockets.indexOf(socket.id);
      if (playerIndex === -1) return;
      if (room.gameState.pendingAction) {
        socket.emit('error', { message: 'Сначала завершите текущее действие' });
        return;
      }

      room.gameState = engine.pass(room.gameState, playerIndex);
      validateStateInvariants('pass', room.gameState, room.code);
      gameLog(room.code, `[P${playerIndex}] pass`);

      settleTimedOutPlayers(room, engine);
      checkRoundAndGameEnd(io, room, engine);
      emitStateToAll(io, room, engine);
    });

    // --- ACTIVATE LEADER ---
    safeOn('activate_leader', ({ targetRow }) => {
      if (targetRow !== undefined && !isCardRow(targetRow)) {
        socket.emit('error', { message: 'Некорректный ряд' });
        return;
      }
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

      settleTimedOutPlayers(room, engine);
      checkRoundAndGameEnd(io, room, engine);
      emitStateToAll(io, room, engine);
    });

    // --- INFORMANT CHOICE ---
    safeOn('informant_choice', ({ cardId }) => {
      if (typeof cardId !== 'string') return;
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
      settleTimedOutPlayers(room, engine);
      checkRoundAndGameEnd(io, room, engine);
      emitStateToAll(io, room, engine);
    });

    // --- ROOTS MOVE ---
    safeOn('roots_move', ({ moves }) => {
      if (!Array.isArray(moves) || moves.length > 2 || moves.some(move => (
        !move || typeof move.cardId !== 'string' || !isCardRow(move.toRow)
      ))) {
        socket.emit('error', { message: 'Некорректные перемещения карт' });
        return;
      }
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
      settleTimedOutPlayers(room, engine);
      checkRoundAndGameEnd(io, room, engine);
      emitStateToAll(io, room, engine);
    });

    // --- RECONNECT ---
    safeOn('reconnect', ({ code, resumeToken }) => {
      if (typeof code !== 'string' || typeof resumeToken !== 'string') return;
      const room = roomManager.getRoom(code);
      if (!room) {
        socket.emit('session_invalid', { message: 'Игровая сессия больше недоступна' });
        return;
      }

      const disconnectedIdx = roomManager.getPlayerIndexForResumeToken(room, resumeToken);

      if (disconnectedIdx === -1 || io.sockets.sockets.has(room.playerSockets[disconnectedIdx])) {
        socket.emit('session_invalid', { message: 'Не удалось подтвердить игровую сесию' });
        return;
      }

      const oldId = room.playerSockets[disconnectedIdx];
      const reconnected = roomManager.reconnect(code, resumeToken, socket.id);
      if (!reconnected) {
        socket.emit('session_invalid', { message: 'Не удалось переподключиться' });
        return;
      }

      socket.join(reconnected.code);
      const playerIndex = disconnectedIdx as 0 | 1;
      socket.emit('session_ready', {
        code: reconnected.code,
        resumeToken: roomManager.getResumeToken(reconnected, playerIndex)!,
      });
      if (reconnected.gameState.phase === 'waiting' || reconnected.gameState.phase === 'faction_select') {
        const opponentIndex = playerIndex === 0 ? 1 : 0;
        socket.emit('lobby_restored', {
          code: reconnected.code,
          phase: reconnected.gameState.phase,
          playerIndex,
          selectedFaction: reconnected.factionSelections.has(playerIndex)
            ? reconnected.gameState.players[playerIndex].faction
            : null,
          opponentConnected: Boolean(
            reconnected.playerSockets[opponentIndex]
            && io.sockets.sockets.has(reconnected.playerSockets[opponentIndex])
          ),
          opponentReady: reconnected.factionSelections.has(opponentIndex),
        });
      } else {
        socket.emit('state_update', {
          state: engine.getVisibleState(reconnected.gameState, playerIndex),
        });

        if (reconnected.gameState.pendingActionPlayer === playerIndex) {
          if (reconnected.gameState.pendingAction === 'medic_choice') {
            const allowed = new Set(reconnected.gameState.pendingMedicCardIds ?? []);
            const cards = reconnected.gameState.players[playerIndex].discard.filter(card => allowed.has(card.id));
            socket.emit('medic_prompt', { cards });
          } else if (reconnected.gameState.pendingAction === 'informant_choice') {
            socket.emit('informant_reveal', { cards: reconnected.gameState.informantRevealed ?? [] });
          } else if (reconnected.gameState.pendingAction === 'roots_move') {
            socket.emit('roots_prompt', {});
          }
        }

        if (reconnected.gameState.partisansPending && engine.getPartisansPlayerIndex(reconnected.gameState) === playerIndex) {
          socket.emit('partisans_prompt', {});
        }
        if (reconnected.gameState.phase === 'game_over') {
          socket.emit('game_over', {
            winner: engine.getWinner(reconnected.gameState),
            finalScore: engine.getFinalScore(reconnected.gameState),
          });
        }
      }
      broadcastToSpectators(io, reconnected, 'player_reconnected', { playerIndex: disconnectedIdx });
      log(`Player reconnected to room ${code}: ${oldId} -> ${socket.id}`);
    });

    // --- SEND EMOTE ---
    safeOn('send_emote', ({ emoteId }) => {
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
        room.disconnectTimers.delete(socket.id);
        room.gameState.log.push(`Player ${playerIndex} disconnect timeout — auto-pass`);
        if (room.gameState.phase === 'waiting' || room.gameState.phase === 'faction_select') {
          io.to(room.code).emit('session_invalid', { message: 'Игрок не вернулся, комната закрыта' });
          roomManager.deleteRoom(room.code);
          return;
        }
        room.timedOutPlayers.add(playerIndex);
        settleTimedOutPlayers(room, engine);
        checkRoundAndGameEnd(io, room, engine);
        emitStateToAll(io, room, engine);
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
  if (state.partisansPending && room.lastPartisansPromptRound !== state.round) {
    const playerIndex = engine.getPartisansPlayerIndex(state);
    if (playerIndex !== -1) {
      room.lastPartisansPromptRound = state.round;
      io.to(room.playerSockets[playerIndex]).emit('partisans_prompt', {});
    }
  }
  const roundResult = state.lastRoundResult;
  if (roundResult && room.lastEmittedRoundResult !== roundResult.round) {
    room.lastEmittedRoundResult = roundResult.round;
    io.to(room.code).emit('round_result', {
      winner: roundResult.winner,
      scores: roundResult.scores,
    });
  }
  if (state.phase === 'game_over') {
    const winner = engine.getWinner(state);
    const finalScore = engine.getFinalScore(state);
    io.to(room.code).emit('game_over', { winner, finalScore });
    gameLog(room.code, `[GAME OVER] winner=P${winner}, score=${finalScore[0]}-${finalScore[1]}`);
  }
}

function settleTimedOutPlayers(room: Room, engine: GameEngine): void {
  // A timeout is a permanent auto-pass until the player reconnects. Resolve
  // transitional phases first so an abandoned slot cannot block the match.
  for (let guard = 0; guard < 10 && room.timedOutPlayers.size > 0; guard++) {
    const before = room.gameState;
    if (before.phase === 'redraw') {
      for (const playerIndex of room.timedOutPlayers) {
        if (!before.redrawsDone.includes(playerIndex)) {
          room.gameState = engine.redrawCards(room.gameState, playerIndex, []);
        }
      }
    } else if (before.phase === 'partisans_choice') {
      const partisansIndex = engine.getPartisansPlayerIndex(before);
      if (!room.timedOutPlayers.has(partisansIndex)) break;
      room.gameState = engine.setPartisansFirst(before, false);
    } else if (before.phase === 'playing') {
      for (const playerIndex of room.timedOutPlayers) {
        room.gameState = engine.forcePass(room.gameState, playerIndex);
      }
    } else {
      break;
    }

    if (room.gameState === before) break;
  }
}

function getSpectatorState(room: Room, engine: GameEngine): SpectatorGameState {
  const state = room.gameState;
  const p0 = state.players[0];
  const p1 = state.players[1];
  const f0 = factions[p0.faction];
  const f1 = factions[p1.faction];
  const p0Strength = engine.calculateStrength(p0, state.weather, state.mutator);
  const p1Strength = engine.calculateStrength(p1, state.weather, state.mutator);

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
    mutator: state.mutator,
    player1: makeView(p0, f0),
    player2: makeView(p1, f1),
    strength: {
      player1: p0Strength,
      player2: p1Strength,
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
