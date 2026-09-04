import { useState, useEffect, useRef } from 'react';
import { useLobbyStore } from '../../store/lobbyStore';
import { MUTATORS } from '../../data/mutators';
import styles from './WaitingRoom.module.css';

export default function WaitingRoom() {
  const roomCode = useLobbyStore(s => s.roomCode);
  const opponentConnected = useLobbyStore(s => s.opponentConnected);
  const error = useLobbyStore(s => s.error);
  const goHome = useLobbyStore(s => s.goHome);
  const selectedMutator = useLobbyStore(s => s.selectedMutator);
  const [copied, setCopied] = useState(false);
  const [dots, setDots] = useState('');
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  // Animate waiting dots
  useEffect(() => {
    if (opponentConnected) return;
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, [opponentConnected]);

  // Auto-transition to faction select
  useEffect(() => {
    if (opponentConnected) {
      const timer = setTimeout(() => {
        useLobbyStore.getState().setScreen('faction_select');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [opponentConnected]);

  const handleCopy = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, 2000);
    } catch {
      // Fallback: do nothing
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Комната создана</h2>
      <span className={styles.codeLabel}>Код комнаты:</span>
      <div className={styles.codeBlock}>
        <span className={styles.code}>{roomCode ?? '------'}</span>
        <button
          className={`${styles.copyBtn} ${copied ? styles.copied : ''}`}
          onClick={handleCopy}
        >
          {copied ? 'Скопировано!' : 'Скопировать'}
        </button>
      </div>
      <p className={styles.hint}>Отправьте код второму игроку</p>

      {selectedMutator !== 'none' && (
        <p className={styles.hint}>
          Мутатор арены: <strong>{MUTATORS[selectedMutator].name}</strong>
          {' — '}{MUTATORS[selectedMutator].description}
        </p>
      )}

      {opponentConnected ? (
        <span className={styles.connected}>Игрок 2 подключился!</span>
      ) : (
        <span className={styles.status}>
          Ожидание подключения<span className={styles.dots}>{dots}</span>
        </span>
      )}

      {error && <span className={styles.error}>{error}</span>}

      <button className={styles.cancelBtn} onClick={goHome}>
        Отмена
      </button>
    </div>
  );
}
