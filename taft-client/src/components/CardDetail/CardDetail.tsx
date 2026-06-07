import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Card } from '../../types/game';
import { ABILITY_LABELS, ROW_LABELS, FACTION_NAMES, FACTION_COLORS } from '../../types/game';
import { getCardImageUrl } from '../../utils/cardArt';
import { CARD_LORE, ABILITY_DESCRIPTIONS } from '../../data/cardLore';
import { useGameStore } from '../../store/gameStore';
import styles from './CardDetail.module.css';

const ROW_DISPLAY: Record<string, string> = {
  melee: 'Ближний бой',
  ranged: 'Дальний бой',
  siege: 'Осада',
};

const TYPE_DISPLAY: Record<string, string> = {
  unit: 'Юнит',
  special: 'Спецкарта',
  weather: 'Погода',
};

/** Strip p0_/p1_ prefix and trailing _N suffix for lore lookup */
function getBaseName(cardId: string): string {
  let name = cardId.replace(/^p\d_/, '');
  name = name.replace(/_\d+$/, '');
  return name;
}

interface Props {
  card: Card;
  onClose: () => void;
}

export default function CardDetail({ card, onClose }: Props) {
  const isMobile = useGameStore(s => s.isMobile);
  const factionColor = FACTION_COLORS[card.faction];
  const artUrl = getCardImageUrl(card.id);
  const baseName = getBaseName(card.id);
  const lore = CARD_LORE[baseName];
  const abilityDesc = ABILITY_DESCRIPTIONS[card.ability];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <motion.div
        className={styles.card}
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28, mass: 0.8 }}
        onClick={e => e.stopPropagation()}
        drag={isMobile ? 'y' : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (isMobile && info.offset.y > 100) onClose();
        }}
      >
        {/* Art area */}
        {artUrl ? (
          <img src={artUrl} alt={card.name} className={styles.art} draggable={false} />
        ) : (
          <div className={styles.artFallback} style={{ background: `${factionColor}26` }}>
            <span className={styles.artFallbackName} style={{ color: factionColor }}>{card.name}</span>
          </div>
        )}

        {/* Strength circle */}
        {card.type === 'unit' && (
          <div className={styles.strengthCircle} style={{ background: factionColor }}>
            {card.strength}
          </div>
        )}

        {/* Info section */}
        <div className={styles.info}>
          {/* Title */}
          <div className={styles.name} style={{ color: factionColor }}>{card.name}</div>
          <div className={styles.faction}>{FACTION_NAMES[card.faction]}</div>

          {/* Badges */}
          <div className={styles.badges}>
            <span className={styles.badge}>{TYPE_DISPLAY[card.type] ?? card.type}</span>
            {card.row && <span className={styles.badge}>{ROW_DISPLAY[card.row] ?? card.row}</span>}
            {card.flexibleRow && <span className={`${styles.badge} ${styles.badgeFlex}`}>Любой ряд</span>}
          </div>

          {/* Ability */}
          {card.ability !== 'none' && (
            <div className={styles.abilitySection}>
              <span className={styles.abilityName}>{ABILITY_LABELS[card.ability]}</span>
              {abilityDesc && <p className={styles.abilityDesc}>{abilityDesc}</p>}
            </div>
          )}

          {/* Lore */}
          {lore && <p className={styles.lore}>{lore}</p>}
        </div>
      </motion.div>
    </motion.div>
  );
}
