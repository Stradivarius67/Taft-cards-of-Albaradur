import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AnimatedNumber from '../AnimatedNumber/AnimatedNumber';
import styles from './ScorePanel.module.css';

interface Props {
  totalStrength: number;
  opponentStrength: number;
  roundsWon: number;
  passed: boolean;
  player: 'self' | 'opponent';
}

function ScorePanel({ totalStrength, opponentStrength, roundsWon, passed, player }: Props) {
  const strengthClass =
    totalStrength > opponentStrength ? styles.winning
    : totalStrength < opponentStrength ? styles.losing
    : styles.tied;

  return (
    <div className={styles.panel}>
      <span className={styles.label}>{player === 'self' ? 'Вы' : 'Противник'}</span>
      <AnimatedNumber value={totalStrength} className={`${styles.strength} ${strengthClass}`} />
      <div className={styles.rounds}>
        {[0, 1].map(i => (
          <span key={i} className={i < roundsWon ? styles.roundWon : styles.roundEmpty}>
            {i < roundsWon ? '●' : '○'}
          </span>
        ))}
      </div>
      <AnimatePresence>
        {passed && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'backOut' }}
            className={styles.passed}
          >
            Пас
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(ScorePanel);
