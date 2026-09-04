import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { disconnect } from '../../services/socket';
import styles from './GameOver.module.css';

export default function GameOver() {
  const result = useGameStore(s => s.gameOverResult);

  if (!result) return null;

  const { won, myRounds, opponentRounds } = result;
  const titleClass = won === true ? styles.won : won === false ? styles.lost : styles.draw;
  const titleText = won === true ? 'Победа!' : won === false ? 'Поражение' : 'Ничья';

  const handleNewGame = () => {
    disconnect();
    window.location.reload();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={styles.overlay}
    >
      <div className={styles.modal}>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'backOut', delay: 0.3 }}
          className={`${styles.title} ${titleClass}`}
        >
          {titleText}
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.3 }}
          className={styles.score}
        >
          Раунды: {myRounds} — {opponentRounds}
        </motion.div>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.2 }}
          className={styles.btn}
          onClick={handleNewGame}
        >
          Новая игра
        </motion.button>
      </div>
    </motion.div>
  );
}
