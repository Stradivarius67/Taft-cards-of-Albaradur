import { useSocket } from './hooks/useSocket';
import { useGameScale } from './hooks/useGameScale';
import { useGameStore } from './store/gameStore';
import Lobby from './components/Lobby/Lobby';
import RedrawPhase from './components/RedrawPhase/RedrawPhase';
import GameField from './components/GameField/GameField';
import SpectatorView from './components/SpectatorView/SpectatorView';

export default function App() {
  useSocket();
  useGameScale();
  const gameState = useGameStore(s => s.gameState);
  const isSpectator = useGameStore(s => s.isSpectator);
  const spectatorState = useGameStore(s => s.spectatorState);

  // Spectator mode
  if (isSpectator && spectatorState) {
    return <SpectatorView />;
  }

  // No game state yet → show lobby
  if (!gameState) {
    return <Lobby />;
  }

  // Redraw phase → show redraw screen
  if (gameState.phase === 'redraw') {
    return <RedrawPhase />;
  }

  // Playing / round_end / game_over → show game field
  return <GameField />;
}
