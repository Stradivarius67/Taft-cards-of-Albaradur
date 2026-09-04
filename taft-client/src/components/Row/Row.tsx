import { memo } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Card, CardRow } from '../../types/game';
import { ROW_LABELS } from '../../types/game';
import CardSlot from '../CardSlot/CardSlot';
import AnimatedNumber from '../AnimatedNumber/AnimatedNumber';
import { useGameStore } from '../../store/gameStore';
import styles from './Row.module.css';

interface Props {
  rowType: CardRow;
  cards: Card[];
  isWeatherActive: boolean;
  isHornActive: boolean;
  strength: number;
  isSelf: boolean;
  onClick?: () => void;
  decoyTargetMode?: boolean;
  onCardClick?: (cardId: string) => void;
  rootsTargetMode?: boolean;
  selectedRootsIds?: string[];
  onRootsTarget?: (cardId: string) => void;
}

/**
 * Можно ли применить Decoy к этой карте.
 * Decoy работает только на свои unit-карты — не на вражеских шпионов
 * (распознаются по полю owner) и не на спец. карты.
 */
function canDecoyTarget(card: Card, myIndex: 0 | 1): boolean {
  if (card.type !== 'unit') return false;
  if (card.owner !== undefined && card.owner !== myIndex) return false;
  return true;
}

function Row({
  rowType, cards, isWeatherActive, isHornActive, strength,
  isSelf, onClick, decoyTargetMode, onCardClick,
  rootsTargetMode, selectedRootsIds = [], onRootsTarget,
}: Props) {
  const myIndex = useGameStore(s => s.gameState?.myIndex ?? 0);
  const isMobile = useGameStore(s => s.isMobile);
  const density = cards.length >= 13 ? styles.overlap : cards.length >= 7 ? styles.dense : '';

  const rowLabels = isMobile
    ? { melee: 'Бл', ranged: 'Дл', siege: 'Ос' }
    : { melee: ROW_LABELS.melee, ranged: ROW_LABELS.ranged, siege: ROW_LABELS.siege };

  return (
    <div
      className={`${styles.row} ${density} ${isWeatherActive ? styles.weatherActive : ''} ${isHornActive ? styles.hornActive : ''} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
    >
      <div className={styles.label}>
        <span className={styles.rowName}>{rowLabels[rowType]}</span>
        <AnimatedNumber value={strength} className={styles.rowStrength} />
        {isWeatherActive && <span className={styles.weatherIcon}>☁ =1</span>}
        {isHornActive && <span className={styles.hornIcon}>🎺 ×2</span>}
      </div>
      <div className={styles.cards}>
        <AnimatePresence mode="popLayout">
          {cards.map(card => {
            const isValidDecoyTarget =
              isSelf && !!decoyTargetMode && canDecoyTarget(card, myIndex);
            const isValidRootsTarget =
              isSelf && !!rootsTargetMode && card.type === 'unit' && !selectedRootsIds.includes(card.id);
            return (
              <CardSlot
                key={card.id}
                card={card}
                isWeatherAffected={isWeatherActive}
                isOpponent={!isSelf}
                highlight={isValidDecoyTarget || isValidRootsTarget}
                onClick={isValidDecoyTarget && onCardClick
                  ? () => onCardClick(card.id)
                  : isValidRootsTarget && onRootsTarget
                    ? () => onRootsTarget(card.id)
                    : undefined}
              />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default memo(Row);
