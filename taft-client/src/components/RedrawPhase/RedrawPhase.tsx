import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { sendRedrawCards } from '../../services/socket';
import { ABILITY_LABELS } from '../../types/game';
import type { Card } from '../../types/game';
import CardImage from '../CardImage/CardImage';
import styles from './RedrawPhase.module.css';

export default function RedrawPhase() {
  const gs = useGameStore(s => s.gameState);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  if (!gs) return null;
  const hand = gs.me.hand;

  const toggleCard = (id: string) => {
    if (submitted) return;
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (next.size >= 2) return;
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleRedraw = () => {
    sendRedrawCards(Array.from(selectedIds));
    setSubmitted(true);
  };

  const handleSkip = () => {
    sendRedrawCards([]);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>Обмен карт</h2>
        <span className={styles.waiting}>Ожидание противника...</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Обмен карт</h2>
      <p className={styles.subtitle}>Выберите до 2 карт для замены (или пропустите)</p>

      <div className={styles.cards}>
        {hand.map(card => (
          <div
            key={card.id}
            className={`${styles.card} ${selectedIds.has(card.id) ? styles.cardSelected : ''}`}
            onClick={() => toggleCard(card.id)}
          >
            <CardImage cardId={card.id} name={card.name} faction={card.faction} size="large" />
            <div className={styles.cardMeta}>
              <span className={styles.cardStrength}>
                {card.type === 'weather' ? '☁' : card.strength}
              </span>
              <span className={styles.cardName}>{card.name}</span>
              {card.ability !== 'none' && (
                <span className={styles.cardAbility}>{ABILITY_LABELS[card.ability]}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.counter}>Выбрано: {selectedIds.size}/2</div>

      <div className={styles.buttons}>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handleRedraw}
          disabled={selectedIds.size === 0}
        >
          Обменять
        </button>
        <button className={styles.btn} onClick={handleSkip}>
          Пропустить
        </button>
      </div>
    </div>
  );
}
