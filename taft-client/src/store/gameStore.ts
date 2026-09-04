import { create } from 'zustand';
import type { Card, CardRow, VisibleGameState, MyPlayerState, OpponentState, StrengthInfo, LeaderAbilityId, SpectatorGameState, FactionId } from '../types/game';
import type { EmoteId } from '../data/emotes';
import * as sock from '../services/socket';

const EMOTE_MUTE_KEY = 'taft:emoteMuted';
function loadEmoteMuted(): boolean {
  try { return localStorage.getItem(EMOTE_MUTE_KEY) === '1'; } catch { return false; }
}
function saveEmoteMuted(v: boolean): void {
  try { localStorage.setItem(EMOTE_MUTE_KEY, v ? '1' : '0'); } catch { /* ignore */ }
}

interface GameStore {
  // --- Server state ---
  gameState: VisibleGameState | null;

  // --- UI state ---
  selectedCardId: string | null;
  showRowPicker: boolean;
  rowPickerContext: 'play_card' | 'horn' | 'leader_rally' | 'leader_curse' | 'decoy' | 'roots' | null;
  showMedicPicker: boolean;
  medicCards: Card[];
  showRoundResult: boolean;
  roundResult: { won: boolean | null; myScore: number; opponentScore: number } | null;
  showGameOver: boolean;
  gameOverResult: { won: boolean | null; myRounds: number; opponentRounds: number } | null;
  showInformantReveal: boolean;
  informantCards: Card[];
  showPartisansPrompt: boolean;
  showRootsMode: boolean;
  rootsMoves: { cardId: string; toRow: CardRow }[];
  isConnected: boolean;
  error: string | null;
  decoyTargetMode: boolean;
  isProcessing: boolean;
  isSpectator: boolean;
  spectatorState: SpectatorGameState | null;
  spectatorCount: number;

  // Card detail
  detailCard: Card | null;

  // Emotes
  activeEmote: { playerIndex: 0 | 1; emoteId: EmoteId; faction: FactionId } | null;
  emoteCooldown: boolean;
  emoteMuted: boolean;

  // Mobile
  isMobile: boolean;

  // --- Getters ---
  isMyTurn: () => boolean;
  me: () => MyPlayerState | null;
  opponent: () => OpponentState | null;
  myStrength: () => StrengthInfo;
  oppStrength: () => StrengthInfo;

  // --- Actions ---
  setGameState: (state: VisibleGameState) => void;
  selectCard: (cardId: string | null) => void;
  playSelectedCard: (targetRow?: CardRow) => void;
  pass: () => void;
  activateLeader: (params?: { targetRow?: CardRow }) => void;
  chooseMedic: (cardId: string | null) => void;
  chooseInformant: (cardId: string) => void;
  choosePartisansFirst: (goFirst: boolean) => void;
  openRowPicker: (context: 'play_card' | 'horn' | 'leader_rally' | 'leader_curse') => void;
  closeRowPicker: () => void;
  setMedicPrompt: (cards: Card[]) => void;
  setRoundResult: (won: boolean | null, myScore: number, opponentScore: number) => void;
  setGameOver: (won: boolean | null, myRounds: number, opponentRounds: number) => void;
  setInformantReveal: (cards: Card[]) => void;
  setPartisansPrompt: (show: boolean) => void;
  setRootsMode: (show: boolean) => void;
  beginRootsMove: (cardId: string) => void;
  addRootsMove: (cardId: string, toRow: CardRow) => void;
  submitRootsMoves: () => void;
  setConnected: (v: boolean) => void;
  setError: (msg: string | null) => void;
  setDecoyTargetMode: (v: boolean) => void;
  handleDecoyTarget: (targetCardId: string) => void;
  setProcessing: (v: boolean) => void;
  setSpectatorState: (state: SpectatorGameState) => void;
  setSpectatorCount: (count: number) => void;
  setDetailCard: (card: Card | null) => void;
  sendEmote: (emoteId: EmoteId) => void;
  showEmote: (playerIndex: 0 | 1, emoteId: EmoteId, faction: FactionId) => void;
  clearEmote: () => void;
  setEmoteMuted: (v: boolean) => void;
  setIsMobile: (v: boolean) => void;
  reset: () => void;
}

let emoteHideTimer: ReturnType<typeof setTimeout> | null = null;
let emoteCooldownTimer: ReturnType<typeof setTimeout> | null = null;
let errorClearTimer: ReturnType<typeof setTimeout> | null = null;

function clearStoreTimers(): void {
  if (emoteHideTimer) clearTimeout(emoteHideTimer);
  if (emoteCooldownTimer) clearTimeout(emoteCooldownTimer);
  if (errorClearTimer) clearTimeout(errorClearTimer);
  emoteHideTimer = null;
  emoteCooldownTimer = null;
  errorClearTimer = null;
}

function calcStrength(field: { melee: Card[]; ranged: Card[]; siege: Card[] }): StrengthInfo {
  const sum = (cards: Card[]) => cards.reduce((s, c) => s + c.strength + (c.strengthModifier ?? 0), 0);
  const m = sum(field.melee);
  const r = sum(field.ranged);
  const s = sum(field.siege);
  return { melee: m, ranged: r, siege: s, total: m + r + s };
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  selectedCardId: null,
  showRowPicker: false,
  rowPickerContext: null,
  showMedicPicker: false,
  medicCards: [],
  showRoundResult: false,
  roundResult: null,
  showGameOver: false,
  gameOverResult: null,
  showInformantReveal: false,
  informantCards: [],
  showPartisansPrompt: false,
  showRootsMode: false,
  rootsMoves: [],
  isConnected: false,
  error: null,
  decoyTargetMode: false,
  isProcessing: false,
  isSpectator: false,
  spectatorState: null,
  spectatorCount: 0,
  detailCard: null,
  activeEmote: null,
  emoteCooldown: false,
  emoteMuted: loadEmoteMuted(),
  isMobile: false,

  isMyTurn: () => {
    const gs = get().gameState;
    if (!gs) return false;
    return gs.phase === 'playing' && gs.currentPlayerIndex === gs.myIndex;
  },

  me: () => get().gameState?.me ?? null,
  opponent: () => get().gameState?.opponent ?? null,

  myStrength: () => {
    const gs = get().gameState;
    if (!gs) return { melee: 0, ranged: 0, siege: 0, total: 0 };
    if (gs.myStrength) return gs.myStrength;
    return calcStrength(gs.me.field);
  },

  oppStrength: () => {
    const gs = get().gameState;
    if (!gs) return { melee: 0, ranged: 0, siege: 0, total: 0 };
    if (gs.opponentStrength) return gs.opponentStrength;
    return calcStrength(gs.opponent.field);
  },

  setGameState: (state) => set({ gameState: state, error: null, isProcessing: false }),

  selectCard: (cardId) => {
    const gs = get().gameState;
    if (!cardId || !gs) { set({ selectedCardId: null, decoyTargetMode: false }); return; }
    if (!get().isConnected || get().isProcessing) return;
    const card = gs.me.hand.find(c => c.id === cardId);
    if (!card) return;

    // Auto-play for fixed-row units and weather
    if (card.type === 'unit' && !card.flexibleRow && card.ability !== 'spy' && card.ability !== 'medic' && card.ability !== 'decoy') {
      sock.sendPlayCard(cardId);
      set({ selectedCardId: null, isProcessing: true });
      return;
    }
    if (card.type === 'unit' && card.ability === 'spy') {
      sock.sendPlayCard(cardId);
      set({ selectedCardId: null, isProcessing: true });
      return;
    }
    if (card.type === 'unit' && card.ability === 'medic' && !card.flexibleRow) {
      sock.sendPlayCard(cardId);
      set({ selectedCardId: null, isProcessing: true });
      return;
    }
    if (card.type === 'weather') {
      sock.sendPlayCard(cardId);
      set({ selectedCardId: null, isProcessing: true });
      return;
    }
    if (card.ability === 'decoy') {
      set({ selectedCardId: cardId, decoyTargetMode: true });
      return;
    }
    if (card.ability === 'horn' || (card.type === 'unit' && card.flexibleRow)) {
      set({
        selectedCardId: cardId,
        showRowPicker: true,
        rowPickerContext: card.ability === 'horn' ? 'horn' : 'play_card',
      });
      return;
    }
    // Medic with flexibleRow
    if (card.ability === 'medic' && card.flexibleRow) {
      set({ selectedCardId: cardId, showRowPicker: true, rowPickerContext: 'play_card' });
      return;
    }
    sock.sendPlayCard(cardId);
    set({ selectedCardId: null });
  },

  playSelectedCard: (targetRow) => {
    if (!get().isConnected || get().isProcessing) return;
    const cardId = get().selectedCardId;
    if (!cardId) return;
    sock.sendPlayCard(cardId, targetRow);
    set({ selectedCardId: null, showRowPicker: false, rowPickerContext: null, isProcessing: true });
  },

  pass: () => {
    if (!get().isConnected || get().isProcessing) return;
    sock.sendPass();
    set({ isProcessing: true });
  },

  activateLeader: (params) => {
    if (!get().isConnected || get().isProcessing) return;
    sock.sendActivateLeader(params);
    set({ isProcessing: true });
  },

  chooseMedic: (cardId) => {
    if (!get().isConnected || get().isProcessing) return;
    sock.sendMedicChoice(cardId);
    set({ showMedicPicker: false, medicCards: [], isProcessing: true });
  },

  chooseInformant: (cardId) => {
    if (!get().isConnected || get().isProcessing) return;
    sock.sendInformantChoice(cardId);
    set({ showInformantReveal: false, informantCards: [], isProcessing: true });
  },

  choosePartisansFirst: (goFirst) => {
    if (!get().isConnected || get().isProcessing) return;
    sock.sendPartisansFirst(goFirst);
    set({ showPartisansPrompt: false, isProcessing: true });
  },

  openRowPicker: (context) => set({ showRowPicker: true, rowPickerContext: context }),
  closeRowPicker: () => set({ showRowPicker: false, rowPickerContext: null, selectedCardId: null }),

  setMedicPrompt: (cards) => set({ showMedicPicker: true, medicCards: cards }),
  setRoundResult: (won, myScore, opponentScore) => set({
    showRoundResult: true,
    roundResult: { won, myScore, opponentScore },
  }),
  setGameOver: (won, myRounds, opponentRounds) => set({
    showGameOver: true,
    gameOverResult: { won, myRounds, opponentRounds },
  }),
  setInformantReveal: (cards) => set({ showInformantReveal: true, informantCards: cards }),
  setPartisansPrompt: (show) => set({ showPartisansPrompt: show }),
  setRootsMode: (show) => set({ showRootsMode: show, rootsMoves: show ? [] : get().rootsMoves }),

  beginRootsMove: (cardId) => {
    const { isConnected, isProcessing, rootsMoves, showRootsMode } = get();
    if (!isConnected || isProcessing || !showRootsMode || rootsMoves.length >= 2) return;
    if (rootsMoves.some(move => move.cardId === cardId)) return;
    set({ selectedCardId: cardId, showRowPicker: true, rowPickerContext: 'roots' });
  },

  addRootsMove: (cardId, toRow) => {
    const moves = [...get().rootsMoves];
    if (moves.length >= 2) return;
    if (moves.some(m => m.cardId === cardId)) return;
    moves.push({ cardId, toRow });
    set({ rootsMoves: moves });
  },

  submitRootsMoves: () => {
    if (!get().isConnected || get().isProcessing) return;
    const moves = get().rootsMoves;
    sock.sendRootsMove(moves);
    set({ showRootsMode: false, rootsMoves: [], isProcessing: true });
  },

  setConnected: (v) => set({ isConnected: v }),
  setError: (msg) => {
    // Любая ошибка с сервера — снимаем "ожидание ответа", иначе клиент
    // блокируется и игрок не может продолжить.
    // Также сбрасываем режим выбора цели для приманки.
    set({
      error: msg,
      isProcessing: false,
      decoyTargetMode: false,
      selectedCardId: null,
    });
    // Авто-скрытие тоста через 2.5с
    if (errorClearTimer) {
      clearTimeout(errorClearTimer);
      errorClearTimer = null;
    }
    if (msg) {
      errorClearTimer = setTimeout(() => {
        set({ error: null });
        errorClearTimer = null;
      }, 2500);
    }
  },
  setDecoyTargetMode: (v) => set({ decoyTargetMode: v }),

  handleDecoyTarget: (targetCardId) => {
    if (!get().isConnected || get().isProcessing) return;
    const cardId = get().selectedCardId;
    if (!cardId) return;
    // For decoy, targetRow is used to pass the targetCardId
    sock.sendPlayCard(cardId, targetCardId as CardRow);
    set({ selectedCardId: null, decoyTargetMode: false, isProcessing: true });
  },

  setProcessing: (v) => set({ isProcessing: v }),

  setDetailCard: (card) => set({ detailCard: card }),

  setSpectatorState: (state) => set({ spectatorState: state, isSpectator: true, error: null }),
  setSpectatorCount: (count) => set({ spectatorCount: count }),

  sendEmote: (emoteId) => {
    if (!get().isConnected || get().emoteCooldown) return;
    sock.sendEmote(emoteId);
    set({ emoteCooldown: true });
    if (emoteCooldownTimer) clearTimeout(emoteCooldownTimer);
    emoteCooldownTimer = setTimeout(() => {
      set({ emoteCooldown: false });
      emoteCooldownTimer = null;
    }, 3000);
  },

  showEmote: (playerIndex, emoteId, faction) => {
    const state = get();
    // Determine if this is from the opponent (for mute)
    const myIdx = state.gameState?.myIndex;
    const isOwn = myIdx !== undefined && playerIndex === myIdx;
    if (state.emoteMuted && !isOwn && !state.isSpectator) return;

    if (emoteHideTimer) clearTimeout(emoteHideTimer);
    set({ activeEmote: { playerIndex, emoteId, faction } });
    emoteHideTimer = setTimeout(() => {
      set({ activeEmote: null });
      emoteHideTimer = null;
    }, 2500);
  },

  clearEmote: () => {
    if (emoteHideTimer) { clearTimeout(emoteHideTimer); emoteHideTimer = null; }
    set({ activeEmote: null });
  },

  setEmoteMuted: (v) => {
    saveEmoteMuted(v);
    set({ emoteMuted: v });
  },

  setIsMobile: (v) => set({ isMobile: v }),

  reset: () => {
    clearStoreTimers();
    set({
      gameState: null, selectedCardId: null, showRowPicker: false, rowPickerContext: null,
      showMedicPicker: false, medicCards: [], showRoundResult: false, roundResult: null,
      showGameOver: false, gameOverResult: null, showInformantReveal: false, informantCards: [],
      showPartisansPrompt: false, showRootsMode: false, rootsMoves: [],
      error: null, decoyTargetMode: false, isProcessing: false,
      isSpectator: false, spectatorState: null, spectatorCount: 0,
      detailCard: null, activeEmote: null, emoteCooldown: false,
    });
  },
}));
