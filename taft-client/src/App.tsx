import { lazy, Suspense } from 'react';
import { useSocket } from './hooks/useSocket';
import { useGameScale } from './hooks/useGameScale';
import { useGameStore } from './store/gameStore';
import Lobby from './components/Lobby/Lobby';

const RedrawPhase = lazy(() => import('./components/RedrawPhase/RedrawPhase'));
const GameField = lazy(() => import('./components/GameField/GameField'));
const SpectatorView = lazy(() => import('./components/SpectatorView/SpectatorView'));

function ScreenLoader() {
  return <div role="status" aria-live="polite">Загрузка игрового поля...</div>;
}

export default function App() {
  useSocket();
  useGameScale();
  const gamePhase = useGameStore(s => s.gameState?.phase ?? null);
  const isSpectator = useGameStore(s => s.isSpectator);
  const hasSpectatorState = useGameStore(s => s.spectatorState !== null);

  let screen;
  if (isSpectator && hasSpectatorState) screen = <SpectatorView />;
  else if (!gamePhase) screen = <Lobby />;
  else if (gamePhase === 'redraw') screen = <RedrawPhase />;
  else screen = <GameField />;

  return <Suspense fallback={<ScreenLoader />}>{screen}</Suspense>;
}
