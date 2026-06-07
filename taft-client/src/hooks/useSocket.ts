import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { useLobbyStore } from '../store/lobbyStore';
import { setupListeners } from '../services/socket';
import type { SpectatorGameState } from '../types/game';

export function useSocket() {
  const isConnected = useGameStore(s => s.isConnected);
  const error = useGameStore(s => s.error);

  useEffect(() => {
    const cleanup = setupListeners({
      onStateUpdate: ({ state }) => {
        if ('isSpectator' in state && (state as SpectatorGameState).isSpectator) {
          useGameStore.getState().setSpectatorState(state as SpectatorGameState);
        } else {
          useGameStore.getState().setGameState(state as any);
        }
      },
      onGameStarted: ({ state }) => {
        useGameStore.getState().setGameState(state);
      },
      onMedicPrompt: ({ cards }) => {
        useGameStore.getState().setMedicPrompt(cards);
      },
      onPartisansPrompt: () => {
        useGameStore.getState().setPartisansPrompt(true);
      },
      onLeaderActivated: () => {},
      onInformantReveal: ({ cards }) => {
        useGameStore.getState().setInformantReveal(cards);
      },
      onRootsPrompt: () => {
        useGameStore.getState().setRootsMode(true);
      },
      onRoundResult: ({ winner, scores }) => {
        const store = useGameStore.getState();
        if (store.isSpectator) {
          // For spectators, show round result with player 1 perspective
          const won = winner === null ? null : winner === 0;
          store.setRoundResult(won, scores[0], scores[1]);
          return;
        }
        const gs = store.gameState;
        if (!gs) return;
        const myIdx = gs.myIndex;
        const won = winner === null ? null : winner === myIdx;
        store.setRoundResult(won, scores[myIdx], scores[myIdx === 0 ? 1 : 0]);
      },
      onGameOver: ({ winner, finalScore }) => {
        const store = useGameStore.getState();
        if (store.isSpectator) {
          const won = winner === null ? null : winner === 0;
          store.setGameOver(won, finalScore[0], finalScore[1]);
          return;
        }
        const gs = store.gameState;
        if (!gs) return;
        const myIdx = gs.myIndex;
        const won = winner === null ? null : winner === myIdx;
        store.setGameOver(won, finalScore[myIdx], finalScore[myIdx === 0 ? 1 : 0]);
      },
      onOpponentDisconnected: () => {
        useGameStore.getState().setError('Противник отключился');
      },
      onError: ({ message }) => {
        useGameStore.getState().setError(message);
        useLobbyStore.getState().setError(message);
      },
      onConnect: () => {
        useGameStore.getState().setConnected(true);
      },
      onDisconnect: () => {
        useGameStore.getState().setConnected(false);
      },
      onRoomCreated: ({ code }) => {
        const lobby = useLobbyStore.getState();
        lobby.setRoomCode(code);
        lobby.setScreen('waiting');
      },
      onPlayerJoined: () => {
        const lobby = useLobbyStore.getState();
        lobby.setOpponentConnected();
        lobby.setScreen('faction_select');
      },
      onFactionSelected: () => {
        useLobbyStore.getState().setOpponentReady();
      },
      onRoomFull: ({ code }) => {
        useLobbyStore.getState().setRoomFull(code);
      },
      onSpectatorJoined: ({ state }) => {
        useGameStore.getState().setSpectatorState(state);
      },
      onSpectatorCount: ({ count }) => {
        useGameStore.getState().setSpectatorCount(count);
      },
      onEmote: ({ playerIndex, emoteId, faction }) => {
        useGameStore.getState().showEmote(playerIndex, emoteId, faction);
      },
    });

    return cleanup;
  }, []);

  return { isConnected, error };
}
