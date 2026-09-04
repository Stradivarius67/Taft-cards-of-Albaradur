import { lazy, Suspense } from 'react';
import { useLobbyStore } from '../../store/lobbyStore';
import HomeScreen from '../HomeScreen/HomeScreen';

const WaitingRoom = lazy(() => import('../WaitingRoom/WaitingRoom'));
const FactionSelect = lazy(() => import('../FactionSelect/FactionSelect'));
const RoomFullScreen = lazy(() => import('../RoomFullScreen/RoomFullScreen'));

export default function Lobby() {
  const screen = useLobbyStore(s => s.screen);

  let content;
  switch (screen) {
    case 'home':
      content = <HomeScreen />;
      break;
    case 'waiting':
      content = <WaitingRoom />;
      break;
    case 'faction_select':
      content = <FactionSelect />;
      break;
    case 'room_full':
      content = <RoomFullScreen />;
      break;
  }

  return <Suspense fallback={<div role="status">Загрузка...</div>}>{content}</Suspense>;
}
