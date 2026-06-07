import { motion } from 'framer-motion';
import type { FactionId } from '../../types/game';
import { EMOTE_LINES, LEADER_NAMES, type EmoteId } from '../../data/emotes';
import styles from './EmoteBubble.module.css';

interface Props {
  emoteId: EmoteId;
  faction: FactionId;
  position: 'top' | 'bottom' | 'left' | 'right';
}

export default function EmoteBubble({ emoteId, faction, position }: Props) {
  const line = EMOTE_LINES[faction][emoteId];
  const leader = LEADER_NAMES[faction];

  return (
    <motion.div
      initial={{ opacity: 0, y: position === 'top' ? -10 : 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: position === 'top' ? -10 : 10 }}
      transition={{ duration: 0.2, ease: 'backOut' }}
      className={`${styles.bubble} ${styles[`bubble_${faction}`]} ${styles[`pos_${position}`]}`}
    >
      <div className={styles.leader}>{leader}</div>
      <div className={styles.line}>{line}</div>
    </motion.div>
  );
}
