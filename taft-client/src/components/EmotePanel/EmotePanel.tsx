import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { EMOTES, EMOTE_LINES, type EmoteId } from '../../data/emotes';
import type { FactionId } from '../../types/game';
import styles from './EmotePanel.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSend: (emoteId: EmoteId) => void;
  cooldownActive: boolean;
  myFaction: FactionId;
}

export default function EmotePanel({ isOpen, onClose, onSend, cooldownActive, myFaction }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid catching the same click that opened the panel
    const t = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleClick = (emoteId: EmoteId) => {
    if (cooldownActive) return;
    onSend(emoteId);
    onClose();
  };

  const lines = EMOTE_LINES[myFaction];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.18, ease: 'backOut' }}
      className={styles.panel}
    >
      <div className={styles.grid}>
        {EMOTES.map(emote => (
          <button
            key={emote.id}
            className={styles.emoteBtn}
            onClick={() => handleClick(emote.id)}
            disabled={cooldownActive}
            title={lines[emote.id]}
          >
            <span className={styles.icon}>{emote.icon}</span>
            <span className={styles.label}>{emote.label}</span>
          </button>
        ))}
      </div>
      {cooldownActive && (
        <div className={styles.cooldownBar}>
          <motion.div
            className={styles.cooldownFill}
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 3, ease: 'linear' }}
          />
        </div>
      )}
    </motion.div>
  );
}
