import { memo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { FACTION_NAMES } from '../../types/game';
import { MUTATORS } from '../../data/mutators';
import styles from './InfoBar.module.css';

const FACTION_SHORT: Record<string, string> = {
  lion_guard: 'Львы',
  imperial_dogs: 'Империя',
  litlad_partisans: 'Литлад',
  grey_rangers: 'Серые',
  vexitar_witches: 'Ведьмы',
};

function InfoBar() {
  const gs = useGameStore(s => s.gameState);
  const isMyTurn = useGameStore(s => s.isMyTurn);
  const spectatorCount = useGameStore(s => s.spectatorCount);
  const emoteMuted = useGameStore(s => s.emoteMuted);
  const setEmoteMuted = useGameStore(s => s.setEmoteMuted);
  const isMobile = useGameStore(s => s.isMobile);

  if (!gs) return null;

  const opp = gs.opponent;
  const myTurn = isMyTurn();
  const mutator = gs.mutator && gs.mutator !== 'none' ? MUTATORS[gs.mutator] : null;

  if (isMobile) {
    return (
      <div className={`${styles.bar} ${styles.barMobile}`}>
        <span className={styles.opponent}>
          {FACTION_SHORT[opp.faction] ?? FACTION_NAMES[opp.faction]} | {opp.hand.count} карт
        </span>
        <span className={styles.round}>Раунд {gs.round}/3</span>
        <span className={`${styles.turnBadge} ${myTurn ? styles.myTurn : styles.oppTurn}`}>
          {myTurn ? 'Ваш ход' : 'Противник'}
        </span>
        {mutator && (
          <span className={styles.mutatorBadge} title={mutator.description}>
            ★ {mutator.name}
          </span>
        )}
        <button
          className={`${styles.muteBtn} ${emoteMuted ? styles.muteBtnActive : ''}`}
          onClick={() => setEmoteMuted(!emoteMuted)}
          title={emoteMuted ? 'Включить реакции противника' : 'Отключить реакции противника'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            {emoteMuted && <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2"/>}
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className={styles.bar}>
      <span className={styles.opponent}>
        Противник: {FACTION_NAMES[opp.faction]} | Карт: {opp.hand.count} | Колода: {opp.deck.count}
      </span>
      <span className={styles.round}>Раунд {gs.round} / 3</span>
      <span className={`${styles.turnBadge} ${myTurn ? styles.myTurn : styles.oppTurn}`}>
        {myTurn ? 'Ваш ход' : 'Ход противника'}
      </span>
      <span className={opp.leaderUsed ? styles.leaderUsed : styles.leaderStatus}>
        Лидер: {opp.leaderUsed ? 'использован' : 'доступен'}
      </span>
      {mutator && (
        <span className={styles.mutatorBadge} title={mutator.description}>
          ★ {mutator.name}
        </span>
      )}
      <button
        className={`${styles.muteBtn} ${emoteMuted ? styles.muteBtnActive : ''}`}
        onClick={() => setEmoteMuted(!emoteMuted)}
        title={emoteMuted ? 'Включить реакции противника' : 'Отключить реакции противника'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          {emoteMuted && <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2"/>}
        </svg>
      </button>
      {spectatorCount > 0 && (
        <span className={styles.spectatorBadge}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          {spectatorCount}
        </span>
      )}
    </div>
  );
}

export default memo(InfoBar);
