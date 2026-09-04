import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WeatherEffects } from '../../types/game';
import { useGameStore } from '../../store/gameStore';
import styles from './WeatherBar.module.css';

interface Props {
  weather: WeatherEffects;
}

const EFFECTS_FULL: { key: keyof WeatherEffects; label: string }[] = [
  { key: 'frost', label: 'Мороз: ближний бой = 1' },
  { key: 'fog', label: 'Туман: дальний бой = 1' },
  { key: 'rain', label: 'Дождь: осада = 1' },
];

const EFFECTS_SHORT: { key: keyof WeatherEffects; label: string }[] = [
  { key: 'frost', label: 'Мороз' },
  { key: 'fog', label: 'Туман' },
  { key: 'rain', label: 'Дождь' },
];

function WeatherBar({ weather }: Props) {
  const isMobile = useGameStore(s => s.isMobile);
  const EFFECTS = isMobile ? EFFECTS_SHORT : EFFECTS_FULL;
  const active = EFFECTS.filter(e => weather[e.key]);

  if (active.length === 0) {
    return <div className={`${styles.bar} ${styles.empty}`} />;
  }

  return (
    <div className={styles.bar}>
      <AnimatePresence mode="popLayout">
        {active.map(e => (
          <motion.span
            key={e.key}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3 }}
            className={styles.effect}
          >
            ☁ {e.label}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default memo(WeatherBar);
