import { useLobbyStore } from '../../store/lobbyStore';
import { sendJoinAsSpectator } from '../../services/socket';
import styles from './RoomFullScreen.module.css';

export default function RoomFullScreen() {
  const roomCode = useLobbyStore(s => s.roomCode);
  const goHome = useLobbyStore(s => s.goHome);

  const handleSpectate = () => {
    if (roomCode) {
      sendJoinAsSpectator(roomCode);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Комната занята</h1>
      <p className={styles.subtitle}>Игра уже идёт. Вы можете наблюдать за матчем.</p>
      <div className={styles.buttons}>
        <button className={styles.spectateBtn} onClick={handleSpectate}>
          Наблюдать за матчем
        </button>
        <button className={styles.backBtn} onClick={goHome}>
          Назад
        </button>
      </div>
    </div>
  );
}
