import { memo } from 'react';
import { motion } from 'framer-motion';
import type { Card } from '../../types/game';
import { ABILITY_LABELS, FACTION_COLORS } from '../../types/game';
import { getCardImageUrl } from '../../utils/cardArt';
import { useGameStore } from '../../store/gameStore';
import { useLongPress } from '../../hooks/useLongPress';
import styles from './CardSlot.module.css';

interface Props {
  card: Card;
  isWeatherAffected: boolean;
  isOpponent: boolean;
  highlight?: boolean;
  onClick?: () => void;
}

function CardSlot({ card, isWeatherAffected, isOpponent, highlight, onClick }: Props) {
  const setDetailCard = useGameStore(s => s.setDetailCard);
  const isMobile = useGameStore(s => s.isMobile);
  const longPressHandlers = useLongPress(() => setDetailCard(card));
  const abilityClass =
    card.ability === 'spy' ? styles.spy
    : card.ability === 'bond' ? styles.bond
    : card.ability === 'morale' ? styles.morale
    : '';

  const factionColor = FACTION_COLORS[card.faction];
  const artUrl = getCardImageUrl(card.id);

  return (
    <motion.div
      layout
      initial={isOpponent
        ? { y: -80, opacity: 0, scale: 0.6 }
        : { y: 80, opacity: 0, scale: 0.6 }
      }
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.7, y: 20 }}
      transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
      className={`${styles.card} ${abilityClass} ${isWeatherAffected ? styles.weathered : ''} ${highlight ? styles.highlight : ''} ${onClick ? styles.clickable : ''} ${artUrl ? styles.hasArt : ''}`}
      style={{
        borderColor: abilityClass ? undefined : factionColor,
        backgroundImage: artUrl ? `url(${artUrl})` : undefined,
      }}
      onClick={onClick ? () => {
        if (!longPressHandlers.shouldSuppressClick()) onClick();
      } : undefined}
      onContextMenu={e => { e.preventDefault(); setDetailCard(card); }}
      onTouchStart={longPressHandlers.onTouchStart}
      onTouchEnd={longPressHandlers.onTouchEnd}
      onTouchMove={longPressHandlers.onTouchMove}
      onTouchCancel={longPressHandlers.onTouchCancel}
    >
      <span className={`${styles.strengthBadge} ${isWeatherAffected ? styles.weatheredBadge : ''}`}>
        {isWeatherAffected && card.type === 'unit' ? 1 : card.strength + (card.strengthModifier ?? 0)}
      </span>
      {card.ability !== 'none' && (
        <span className={styles.abilityBadge}>{ABILITY_LABELS[card.ability][0]}</span>
      )}
      {!artUrl && !isMobile && <span className={styles.name}>{card.name}</span>}
      <div className={styles.tooltip}>
        {card.name} ({card.strength})
        {card.ability !== 'none' && ` — ${ABILITY_LABELS[card.ability]}`}
      </div>
    </motion.div>
  );
}

export default memo(CardSlot);
