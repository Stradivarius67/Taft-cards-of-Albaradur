import { useState } from 'react';
import { getCardImageUrl, getLeaderImageUrl } from '../../utils/cardArt';
import type { FactionId } from '../../types/game';
import styles from './CardImage.module.css';

const FACTION_FALLBACK_COLORS: Record<FactionId, string> = {
  lion_guard: '#D4A843',
  imperial_dogs: '#C0392B',
  litlad_partisans: '#27AE60',
  grey_rangers: '#7F8C8D',
  vexitar_witches: '#6C3483',
};

const SIZES = {
  tiny: { width: 36, height: 50 },
  small: { width: 50, height: 70 },
  medium: { width: 65, height: 90 },
  large: { width: 100, height: 140 },
} as const;

interface Props {
  cardId: string;
  name: string;
  faction: FactionId;
  size?: 'tiny' | 'small' | 'medium' | 'large';
  isLeader?: boolean;
  className?: string;
}

export default function CardImage({ cardId, name, faction, size = 'medium', isLeader, className }: Props) {
  const url = isLeader ? getLeaderImageUrl(cardId) : getCardImageUrl(cardId);
  const [imgError, setImgError] = useState(false);
  const { width, height } = SIZES[size];
  const color = FACTION_FALLBACK_COLORS[faction];

  if (!url || imgError) {
    return (
      <div
        className={`${styles.fallback} ${className ?? ''}`}
        style={{
          width, height,
          background: `${color}26`,
          borderColor: `${color}80`,
        }}
      >
        <span className={styles.fallbackName} style={{ color }}>{name}</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      className={`${styles.image} ${className ?? ''}`}
      style={{ width, height }}
      onError={() => setImgError(true)}
      draggable={false}
    />
  );
}
