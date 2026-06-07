import { create } from 'zustand';
import type { FactionId } from '../types/game';
import * as sock from '../services/socket';

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
  goHome: () => void;
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

  createRoom: () => {
    set({ isLoading: true, error: null });
    sock.sendCreateRoom(get().openHands);
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
    });
  },

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
  }),
}));
