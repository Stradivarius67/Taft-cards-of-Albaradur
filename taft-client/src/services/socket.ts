import { io, Socket } from 'socket.io-client';
import type { CardRow, Card, VisibleGameState, LeaderAbilityId, FactionId, SpectatorGameState } from '../types/game';
import type { EmoteId } from '../data/emotes';
import type { ArenaMutator } from '../data/mutators';

function getBackendUrl(): string {
  // 1. Explicit env override
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  // 2. Dev mode — separate server on port 3000
  if (import.meta.env.DEV) {
    return 'http://localhost:3000';
  }
  // 3. Production — client served from same origin as server
  return window.location.origin;
}

const BACKEND_URL = getBackendUrl();
const IS_DEV = import.meta.env.DEV;

function devLog(direction: string, event: string, data?: unknown): void {
  if (!IS_DEV) return;
  if (data !== undefined) {
    console.log(`%c${direction} ${event}`, 'color: #888; font-weight: bold', data);
  } else {
    console.log(`%c${direction} ${event}`, 'color: #888; font-weight: bold');
  }
}

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BACKEND_URL, { autoConnect: false });
  }
  return socket;
}

export function connect(): void {
  const s = getSocket();
  if (!s.connected) s.connect();
}

export function disconnect(): void {
  getSocket().disconnect();
}

export function sendPlayCard(cardId: string, targetRow?: CardRow): void {
  devLog('\u2192', 'play_card', { cardId, targetRow });
  getSocket().emit('play_card', { cardId, targetRow });
}

export function sendPass(): void {
  devLog('\u2192', 'pass');
  getSocket().emit('pass');
}

export function sendActivateLeader(params?: { targetRow?: CardRow }): void {
  devLog('\u2192', 'activate_leader', params);
  getSocket().emit('activate_leader', params ?? {});
}

export function sendMedicChoice(cardId: string | null): void {
  devLog('\u2192', 'medic_choice', { cardId });
  getSocket().emit('medic_choice', { cardId });
}

export function sendInformantChoice(cardId: string): void {
  devLog('\u2192', 'informant_choice', { cardId });
  getSocket().emit('informant_choice', { cardId });
}

export function sendRootsMove(moves: { cardId: string; toRow: CardRow }[]): void {
  devLog('\u2192', 'roots_move', { moves });
  getSocket().emit('roots_move', { moves });
}

export function sendPartisansFirst(goFirst: boolean): void {
  devLog('\u2192', 'partisans_first', { goFirst });
  getSocket().emit('partisans_first', { goFirst });
}

export function sendRedrawCards(cardIds: string[]): void {
  devLog('\u2192', 'redraw_cards', { cardIds });
  getSocket().emit('redraw_cards', { cardIds });
}

export function sendSelectFaction(faction: string): void {
  devLog('\u2192', 'select_faction', { faction });
  getSocket().emit('select_faction', { faction });
}

export function sendCreateRoom(openHands = false, mutator: ArenaMutator = 'none'): void {
  devLog('\u2192', 'create_room', { openHands, mutator });
  getSocket().emit('create_room', { openHands, mutator });
}

export function sendJoinRoom(code: string): void {
  devLog('\u2192', 'join_room', { code });
  getSocket().emit('join_room', { code });
}

export function sendJoinAsSpectator(code: string): void {
  devLog('\u2192', 'join_as_spectator', { code });
  getSocket().emit('join_as_spectator', { code });
}

export function sendEmote(emoteId: EmoteId): void {
  devLog('\u2192', 'send_emote', { emoteId });
  getSocket().emit('send_emote', { emoteId });
}

export type SocketEventHandlers = {
  onStateUpdate: (data: { state: VisibleGameState | SpectatorGameState }) => void;
  onGameStarted: (data: { state: VisibleGameState }) => void;
  onMedicPrompt: (data: { cards: Card[] }) => void;
  onPartisansPrompt: () => void;
  onLeaderActivated: (data: { playerIndex: number; abilityId: LeaderAbilityId }) => void;
  onInformantReveal: (data: { cards: Card[] }) => void;
  onRootsPrompt: () => void;
  onRoundResult: (data: { winner: number | null; scores: [number, number] }) => void;
  onGameOver: (data: { winner: number | null; finalScore: [number, number] }) => void;
  onOpponentDisconnected: () => void;
  onError: (data: { message: string }) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onRoomCreated: (data: { code: string }) => void;
  onPlayerJoined: () => void;
  onFactionSelected: (data: { playerIndex: number; faction: FactionId }) => void;
  onRoomFull: (data: { code: string }) => void;
  onSpectatorJoined: (data: { state: SpectatorGameState }) => void;
  onSpectatorCount: (data: { count: number }) => void;
  onEmote: (data: { playerIndex: 0 | 1; emoteId: EmoteId; faction: FactionId }) => void;
};

export function setupListeners(handlers: SocketEventHandlers): () => void {
  const s = getSocket();

  function wrapHandler<T>(event: string, handler: (data: T) => void) {
    return (data: T) => {
      devLog('\u2190', event, event === 'state_update' ? { phase: (data as { state?: { phase?: string } })?.state?.phase } : data);
      handler(data);
    };
  }

  const wrapped = {
    state_update: wrapHandler('state_update', handlers.onStateUpdate),
    game_started: wrapHandler('game_started', handlers.onGameStarted),
    medic_prompt: wrapHandler('medic_prompt', handlers.onMedicPrompt),
    partisans_prompt: wrapHandler('partisans_prompt', handlers.onPartisansPrompt),
    leader_activated: wrapHandler('leader_activated', handlers.onLeaderActivated),
    informant_reveal: wrapHandler('informant_reveal', handlers.onInformantReveal),
    roots_prompt: wrapHandler('roots_prompt', handlers.onRootsPrompt),
    round_result: wrapHandler('round_result', handlers.onRoundResult),
    game_over: wrapHandler('game_over', handlers.onGameOver),
    opponent_disconnected: wrapHandler('opponent_disconnected', handlers.onOpponentDisconnected),
    error: wrapHandler('error', handlers.onError),
    connect: wrapHandler('connect', handlers.onConnect),
    disconnect: wrapHandler('disconnect', handlers.onDisconnect),
    room_created: wrapHandler('room_created', handlers.onRoomCreated),
    player_joined: wrapHandler('player_joined', handlers.onPlayerJoined),
    faction_selected: wrapHandler('faction_selected', handlers.onFactionSelected),
    room_full: wrapHandler('room_full', handlers.onRoomFull),
    spectator_joined: wrapHandler('spectator_joined', handlers.onSpectatorJoined),
    spectator_count: wrapHandler('spectator_count', handlers.onSpectatorCount),
    emote: wrapHandler('emote', handlers.onEmote),
  };

  s.on('state_update', wrapped.state_update);
  s.on('game_started', wrapped.game_started);
  s.on('medic_prompt', wrapped.medic_prompt);
  s.on('partisans_prompt', wrapped.partisans_prompt as () => void);
  s.on('leader_activated', wrapped.leader_activated);
  s.on('informant_reveal', wrapped.informant_reveal);
  s.on('roots_prompt', wrapped.roots_prompt as () => void);
  s.on('round_result', wrapped.round_result);
  s.on('game_over', wrapped.game_over);
  s.on('opponent_disconnected', wrapped.opponent_disconnected as () => void);
  s.on('error', wrapped.error);
  s.on('connect', wrapped.connect as () => void);
  s.on('disconnect', wrapped.disconnect as () => void);
  s.on('room_created', wrapped.room_created);
  s.on('player_joined', wrapped.player_joined as () => void);
  s.on('faction_selected', wrapped.faction_selected);
  s.on('room_full' as any, wrapped.room_full);
  s.on('spectator_joined' as any, wrapped.spectator_joined);
  s.on('spectator_count' as any, wrapped.spectator_count);
  s.on('emote' as any, wrapped.emote);

  return () => {
    s.off('state_update', wrapped.state_update);
    s.off('game_started', wrapped.game_started);
    s.off('medic_prompt', wrapped.medic_prompt);
    s.off('partisans_prompt', wrapped.partisans_prompt);
    s.off('leader_activated', wrapped.leader_activated);
    s.off('informant_reveal', wrapped.informant_reveal);
    s.off('roots_prompt', wrapped.roots_prompt);
    s.off('round_result', wrapped.round_result);
    s.off('game_over', wrapped.game_over);
    s.off('opponent_disconnected', wrapped.opponent_disconnected);
    s.off('error', wrapped.error);
    s.off('connect', wrapped.connect as () => void);
    s.off('disconnect', wrapped.disconnect as () => void);
    s.off('room_created', wrapped.room_created);
    s.off('player_joined', wrapped.player_joined as () => void);
    s.off('faction_selected', wrapped.faction_selected);
    s.off('room_full' as any, wrapped.room_full);
    s.off('spectator_joined' as any, wrapped.spectator_joined);
    s.off('spectator_count' as any, wrapped.spectator_count);
    s.off('emote' as any, wrapped.emote);
  };
}
