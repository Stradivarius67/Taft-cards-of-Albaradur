import { getLeaderImageUrl } from '../../utils/cardArt';
import type { FactionId } from '../../types/game';
import styles from './FactionCard.module.css';

interface Props {
  name: string;
  leader: string;
  leaderId: string;
  faction: FactionId;
  passive: string;
  leaderAbility: string;
  description: string;
  color: string;
  isSelected: boolean;
  isDisabled: boolean;
  onClick: () => void;
}

export default function FactionCard({
  name, leader, leaderId, faction, passive, leaderAbility, description,
  color, isSelected, isDisabled, onClick,
}: Props) {
  const leaderArt = getLeaderImageUrl(leaderId);

  return (
    <div
      className={`${styles.card} ${isSelected ? styles.selected : ''} ${isDisabled ? styles.disabled : ''}`}
      style={{ borderColor: isSelected ? color : undefined }}
      onClick={isDisabled ? undefined : onClick}
    >
      {leaderArt ? (
        <div className={styles.leaderArt} style={{ backgroundImage: `url(${leaderArt})` }} />
      ) : (
        <div className={styles.leaderFallback} style={{ background: `${color}26` }}>
          <span style={{ color, fontSize: 13, opacity: 0.7 }}>{leader}</span>
        </div>
      )}
      <div className={styles.accent} style={{ background: color }} />
      <div className={styles.body}>
        <div className={styles.name} style={{ color }}>{name}</div>
        <div className={styles.leader}>{leader}</div>
        <div className={styles.info}>
          <span className={styles.infoLabel}>Пассивка: </span>{passive}
        </div>
        <div className={styles.info}>
          <span className={styles.infoLabel}>Лидер: </span>{leaderAbility}
        </div>
        <div className={styles.description}>{description}</div>
      </div>
    </div>
  );
}
