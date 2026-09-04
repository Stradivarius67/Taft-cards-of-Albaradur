import { useState, type KeyboardEvent } from 'react';
import { useLobbyStore } from '../../store/lobbyStore';
import { connect } from '../../services/socket';
import { MUTATORS, MUTATOR_ORDER, getWeeklyMutator, type ArenaMutator } from '../../data/mutators';
import styles from './HomeScreen.module.css';

const VALID_CHARS = /^[A-Z2-9]$/;
const WEEKLY_MUTATOR = getWeeklyMutator();

export default function HomeScreen() {
  const [code, setCode] = useState('');
  const createRoom = useLobbyStore(s => s.createRoom);
  const joinRoom = useLobbyStore(s => s.joinRoom);
  const error = useLobbyStore(s => s.error);
  const isLoading = useLobbyStore(s => s.isLoading);
  const openHands = useLobbyStore(s => s.openHands);
  const setOpenHands = useLobbyStore(s => s.setOpenHands);
  const selectedMutator = useLobbyStore(s => s.selectedMutator);
  const setMutator = useLobbyStore(s => s.setMutator);

  const handleCodeChange = (value: string) => {
    const upper = value.toUpperCase();
    const filtered = upper.split('').filter(c => VALID_CHARS.test(c)).join('');
    setCode(filtered.slice(0, 6));
  };

  const handleCreate = () => {
    connect();
    createRoom();
  };

  const handleJoin = () => {
    if (code.length !== 6) return;
    connect();
    joinRoom(code);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleJoin();
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Тафт: Карты Альбарадура</h1>
      <p className={styles.subtitle}>Карточная мини-игра для двоих</p>

      <div className={styles.content}>
        <button
          className={styles.createBtn}
          onClick={handleCreate}
          disabled={isLoading}
        >
          {isLoading ? 'Создание...' : 'Создать комнату'}
        </button>

        <label className={styles.openHandsLabel}>
          <input
            type="checkbox"
            checked={openHands}
            onChange={e => setOpenHands(e.target.checked)}
          />
          Режим открытых карт (мастер видит руки)
        </label>

        <div className={styles.mutatorSection}>
          <div className={styles.mutatorHeader}>
            <span>Мутатор арены</span>
            <span className={styles.weeklyBadge}>
              ★ недели: {MUTATORS[WEEKLY_MUTATOR].name}
            </span>
          </div>
          <select
            className={styles.mutatorSelect}
            value={selectedMutator}
            onChange={e => setMutator(e.target.value as ArenaMutator)}
          >
            {MUTATOR_ORDER.map(id => (
              <option key={id} value={id}>
                {MUTATORS[id].name}{id === WEEKLY_MUTATOR ? ' ★' : ''}
              </option>
            ))}
          </select>
          <span className={styles.mutatorDesc}>{MUTATORS[selectedMutator].description}</span>
        </div>

        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerText}>или</span>
          <span className={styles.dividerLine} />
        </div>

        <div className={styles.joinSection}>
          <input
            className={styles.codeInput}
            type="text"
            placeholder="Код комнаты"
            value={code}
            onChange={e => handleCodeChange(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={6}
          />
          <button
            className={styles.joinBtn}
            onClick={handleJoin}
            disabled={code.length !== 6 || isLoading}
          >
            Присоединиться
          </button>
          {error && <span className={styles.error}>{error}</span>}
        </div>
      </div>
    </div>
  );
}
