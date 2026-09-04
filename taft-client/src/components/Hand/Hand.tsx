import { memo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { FACTION_NAMES } from '../../types/game';
import HandCard from '../HandCard/HandCard';
import styles from './Hand.module.css';

function Hand() {
  const gs = useGameStore(s => s.gameState);
  const selectedCardId = useGameStore(s => s.selectedCardId);
  const selectCard = useGameStore(s => s.selectCard);
  const isMobile = useGameStore(s => s.isMobile);
  const isConnected = useGameStore(s => s.isConnected);
  const isProcessing = useGameStore(s => s.isProcessing);

  if (!gs) return null;
  const { hand, faction, deck } = gs.me;

  const cramped = hand.length >= 8 ? styles.cramped : '';
  const handEnabled = isConnected
    && !isProcessing
    && gs.phase === 'playing'
    && gs.currentPlayerIndex === gs.myIndex
    && !gs.me.passed;

  return (
    <div className={`${styles.hand} ${cramped}`}>
      <div className={styles.header}>
        <span className={styles.title}>
          Ваша рука ({hand.length} карт) — {FACTION_NAMES[faction]}
        </span>
        <span className={styles.deckInfo}>Колода: {deck.count}</span>
      </div>
      <div className={styles.cards}>
        <AnimatePresence mode="popLayout">
          {hand.map(card => (
            <HandCard
              key={card.id}
              card={card}
              isSelected={card.id === selectedCardId}
              canPlay={handEnabled}
              onClick={() => selectCard(card.id)}
            />
          ))}
        </AnimatePresence>
      </div>
      {isMobile && hand.length > 5 && (
        <div style={{ textAlign: 'center', fontSize: 10, opacity: 0.5, color: '#aaa' }}>→ прокрутите</div>
      )}
    </div>
  );
}

export default memo(Hand);
