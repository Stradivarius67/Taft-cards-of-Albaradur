import { create } from 'zustand';
import type { FactionId } from '../types/game';
import * as sock from '../services/socket';
import { type ArenaMutator, getWeeklyMutator } from '../data/mutators';

export type LobbyScreen = 'home' | 'waiting' | 'faction_select' | 'room_full';

interface LobbyStore {
  screen: LobbyScreen;
  roomCode: string | null;
  isHost: boolean;
  opponentConnected: boolean;
  selectedFaction: FactionId | null;
  factionConfirmed: boolean;
  opponentReady: boolean;
  error: string | null;
  isLoading: boolean;
  openHands: boolean;
  selectedMutator: ArenaMutator;

  createRoom: () => void;
  joinRoom: (code: string) => void;
  selectFaction: (faction: FactionId) => void;
  confirmFaction: () => void;
  setOpponentConnected: () => void;
  setOpponentReady: () => void;
  setRoomCode: (code: string) => void;
  setError: (msg: string | null) => void;
  setScreen: (screen: LobbyScreen) => void;
  setRoomFull: (code: string) => void;
  setOpenHands: (v: boolean) => void;
  setMutator: (m: ArenaMutator) => void;
  goHome: () => void;
  restoreSession: (data: {
    code: string;
    phase: 'waiting' | 'faction_select';
    playerIndex: 0 | 1;
    selectedFaction: FactionId | null;
    opponentConnected: boolean;
    opponentReady: boolean;
  }) => void;
  reset: () => void;
}

export const useLobbyStore = create<LobbyStore>((set, get) => ({
  screen: 'home',
  roomCode: null,
  isHost: false,
  opponentConnected: false,
  selectedFaction: null,
  factionConfirmed: false,
  opponentReady: false,
  error: null,
  isLoading: false,
  openHands: false,
  selectedMutator: getWeeklyMutator(),

  createRoom: () => {
    set({ isLoading: true, error: null });
    sock.sendCreateRoom(get().openHands, get().selectedMutator);
  },

  joinRoom: (code: string) => {
    set({ isLoading: true, error: null, roomCode: code });
    sock.sendJoinRoom(code);
  },

  selectFaction: (faction: FactionId) => {
    if (get().factionConfirmed) return;
    set({ selectedFaction: faction });
  },

  confirmFaction: () => {
    const faction = get().selectedFaction;
    if (!faction || get().factionConfirmed) return;
    sock.sendSelectFaction(faction);
    set({ factionConfirmed: true });
  },

  setOpponentConnected: () => set({ opponentConnected: true }),
  setOpponentReady: () => set({ opponentReady: true }),
  setRoomCode: (code: string) => set({ roomCode: code, isLoading: false }),
  setError: (msg: string | null) => set({ error: msg, isLoading: false }),
  setScreen: (screen: LobbyScreen) => set({ screen }),
  setRoomFull: (code: string) => set({ screen: 'room_full', roomCode: code, isLoading: false }),
  setOpenHands: (v: boolean) => set({ openHands: v }),
  setMutator: (m: ArenaMutator) => set({ selectedMutator: m }),

  goHome: () => {
    sock.disconnect();
    set({
      screen: 'home',
      roomCode: null,
      isHost: false,
      opponentConnected: false,
      selectedFaction: null,
      factionConfirmed: false,
      opponentReady: false,
      error: null,
      isLoading: false,
      openHands: false,
      selectedMutator: getWeeklyMutator(),
    });
  },

  restoreSession: (data) => set({
    screen: data.phase === 'waiting' ? 'waiting' : 'faction_select',
    roomCode: data.code,
    isHost: data.playerIndex === 0,
    opponentConnected: data.opponentConnected,
    selectedFaction: data.selectedFaction,
    factionConfirmed: data.selectedFaction !== null,
    opponentReady: data.opponentReady,
    error: null,
    isLoading: false,
  }),

  reset: () => set({
    screen: 'home',
    roomCode: null,
    isHost: false,
    opponentConnected: false,
    selectedFaction: null,
    factionConfirmed: false,
    opponentReady: false,
    error: null,
    isLoading: false,
    openHands: false,
    selectedMutator: getWeeklyMutator(),
  }),
}));
