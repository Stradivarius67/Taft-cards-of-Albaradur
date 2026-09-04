import { memo } from 'react';
import { motion } from 'framer-motion';
import type { Card } from '../../types/game';
import { ABILITY_LABELS, FACTION_COLORS, ROW_LABELS } from '../../types/game';
import { getCardImageUrl } from '../../utils/cardArt';
import { useGameStore } from '../../store/gameStore';
import { useLongPress } from '../../hooks/useLongPress';
import styles from './HandCard.module.css';

interface Props {
  card: Card;
  isSelected: boolean;
  canPlay: boolean;
  onClick: () => void;
}

function HandCard({ card, isSelected, canPlay, onClick }: Props) {
  const setDetailCard = useGameStore(s => s.setDetailCard);
  const isMobile = useGameStore(s => s.isMobile);
  const longPressHandlers = useLongPress(() => setDetailCard(card));
  const typeClass =
    card.type === 'special' ? styles.special
    : card.type === 'weather' ? styles.weather
    : '';

  const factionColor = FACTION_COLORS[card.faction];
  const artUrl = getCardImageUrl(card.id);

  return (
    <motion.div
      layout
      initial={{ x: 100, opacity: 0, scale: 0.8 }}
      animate={{
        x: 0,
        opacity: 1,
        scale: 1,
        y: isSelected ? -12 : 0,
      }}
      exit={{ y: -60, opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      whileHover={!isMobile && canPlay ? { y: isSelected ? -12 : -6, scale: 1.03 } : {}}
      whileTap={canPlay ? { scale: 0.95 } : {}}
      className={`${styles.card} ${typeClass} ${isSelected ? styles.selected : ''} ${!canPlay ? styles.disabled : ''} ${artUrl ? styles.hasArt : ''}`}
      style={{
        borderColor: isSelected ? undefined : (typeClass ? undefined : factionColor),
        backgroundImage: artUrl ? `url(${artUrl})` : undefined,
      }}
      onClick={canPlay ? () => {
        if (!longPressHandlers.shouldSuppressClick()) onClick();
      } : undefined}
      onContextMenu={e => { e.preventDefault(); setDetailCard(card); }}
      onTouchStart={longPressHandlers.onTouchStart}
      onTouchEnd={longPressHandlers.onTouchEnd}
      onTouchMove={longPressHandlers.onTouchMove}
      onTouchCancel={longPressHandlers.onTouchCancel}
    >
      <span className={styles.strengthBadge}>
        {card.type === 'weather' ? '☁' : card.strength}
      </span>
      {card.row && (
        <span className={styles.rowBadge}>{ROW_LABELS[card.row][0]}</span>
      )}
      <div className={styles.bottom}>
        <span className={styles.name}>{card.name}</span>
        {card.ability !== 'none' && (
          <span className={styles.abilityTag}>{ABILITY_LABELS[card.ability]}</span>
        )}
      </div>
      <div className={styles.tooltip}>
        {card.name} {card.type !== 'weather' && `(${card.strength})`}
        {card.ability !== 'none' && ` — ${ABILITY_LABELS[card.ability]}`}
        {card.row && ` [${card.row}]`}
        {card.flexibleRow && ' [гибкий ряд]'}
      </div>
    </motion.div>
  );
}

export default memo(HandCard);
