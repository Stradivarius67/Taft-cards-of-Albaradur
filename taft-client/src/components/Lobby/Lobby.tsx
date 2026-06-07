import { useLobbyStore } from '../../store/lobbyStore';
import HomeScreen from '../HomeScreen/HomeScreen';
import WaitingRoom from '../WaitingRoom/WaitingRoom';
import FactionSelect from '../FactionSelect/FactionSelect';
import RoomFullScreen from '../RoomFullScreen/RoomFullScreen';

export default function Lobby() {
  const screen = useLobbyStore(s => s.screen);

  switch (screen) {
    case 'home':
      return <HomeScreen />;
    case 'waiting':
      return <WaitingRoom />;
    case 'faction_select':
      return <FactionSelect />;
    case 'room_full':
      return <RoomFullScreen />;
  }
}
