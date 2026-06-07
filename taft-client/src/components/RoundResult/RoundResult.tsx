import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import styles from './RoundResult.module.css';

export default function RoundResult() {
  const roundResult = useGameStore(s => s.roundResult);
  const close = () => useGameStore.setState({ showRoundResult: false, roundResult: null });

  useEffect(() => {
    const timer = setTimeout(close, 2500);
    return () => clearTimeout(timer);
  }, []);

  if (!roundResult) return null;

  const { won, myScore, opponentScore } = roundResult;
  const titleClass = won === true ? styles.won : won === false ? styles.lost : styles.draw;
  const titleText = won === true ? 'Раунд выигран!' : won === false ? 'Раунд проигран' : 'Ничья';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={styles.overlay}
      onClick={close}
    >
      <motion.div
        initial={{ y: -50, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -30, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'backOut' }}
        className={styles.modal}
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'backOut', delay: 0.1 }}
          className={`${styles.title} ${titleClass}`}
        >
          {titleText}
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className={styles.score}
        >
          Ваша сила: {myScore} — Противник: {opponentScore}
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className={styles.rulesHint}
        >
          Карты не раздаются между раундами — распределяйте оставшуюся руку.
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className={styles.hint}
        >
          Нажмите для продолжения
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
