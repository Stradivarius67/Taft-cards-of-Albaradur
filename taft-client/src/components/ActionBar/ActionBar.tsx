import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import type { LeaderAbilityId } from '../../types/game';
import { FACTION_COLORS } from '../../types/game';
import EmotePanel from '../EmotePanel/EmotePanel';
import styles from './ActionBar.module.css';

const LEADER_NAMES: Record<LeaderAbilityId, string> = {
  rally_the_guard: 'Сплочение гвардии',
  imperial_informant: 'Имперский осведомитель',
  roots_of_tungrad: 'Корни Тунграда',
  blood_ritual: 'Кровавый ритуал',
  witches_curse: 'Проклятие Гризельды',
};

export default function ActionBar() {
  const gs = useGameStore(s => s.gameState);
  const isMyTurn = useGameStore(s => s.isMyTurn);
  const pass = useGameStore(s => s.pass);
  const activateLeader = useGameStore(s => s.activateLeader);
  const openRowPicker = useGameStore(s => s.openRowPicker);
  const setRootsMode = useGameStore(s => s.setRootsMode);
  const sendEmoteAction = useGameStore(s => s.sendEmote);
  const emoteCooldown = useGameStore(s => s.emoteCooldown);
  const isMobile = useGameStore(s => s.isMobile);
  const [confirmPass, setConfirmPass] = useState(false);
  const [emotePanelOpen, setEmotePanelOpen] = useState(false);

  if (!gs) return null;

  const myTurn = isMyTurn();
  const me = gs.me;
  const factionColor = FACTION_COLORS[me.faction];

  const emoteButton = (
    <div className={styles.emoteWrapper}>
      <button
        className={styles.emoteButton}
        onClick={() => setEmotePanelOpen(v => !v)}
        title="Реакции"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
      </button>
      <AnimatePresence>
        {emotePanelOpen && (
          <EmotePanel
            isOpen={emotePanelOpen}
            onClose={() => setEmotePanelOpen(false)}
            onSend={sendEmoteAction}
            cooldownActive={emoteCooldown}
            myFaction={me.faction}
          />
        )}
      </AnimatePresence>
    </div>
  );

  if (!myTurn) {
    return (
      <div className={styles.bar}>
        <motion.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className={styles.waitText}
        >
          Ожидание хода противника...
        </motion.span>
        {emoteButton}
      </div>
    );
  }

  const handlePass = () => {
    if (!confirmPass) {
      setConfirmPass(true);
      return;
    }
    pass();
    setConfirmPass(false);
  };

  const handleLeader = () => {
    const abilityId = me.leaderAbility as LeaderAbilityId;
    switch (abilityId) {
      case 'rally_the_guard':
        openRowPicker('leader_rally');
        break;
      case 'imperial_informant':
        activateLeader();
        break;
      case 'roots_of_tungrad':
        activateLeader();
        setRootsMode(true);
        break;
      case 'blood_ritual':
        activateLeader();
        break;
      case 'witches_curse':
        openRowPicker('leader_curse');
        break;
    }
  };

  return (
    <div className={styles.bar}>
      <button
        className={`${styles.btn} ${styles.passBtn}`}
        onClick={handlePass}
        disabled={me.passed}
      >
        {confirmPass ? 'Подтвердить пас?' : 'Пас'}
      </button>

      {me.canActivateLeader && (
        <motion.button
          whileHover={{ boxShadow: `0 0 12px ${factionColor}44` }}
          className={`${styles.btn} ${styles.leaderBtn}`}
          onClick={handleLeader}
        >
          {isMobile ? 'Лидер' : (LEADER_NAMES[me.leaderAbility as LeaderAbilityId] ?? 'Способность лидера')}
        </motion.button>
      )}

      {confirmPass && (
        <button
          className={styles.btn}
          onClick={() => setConfirmPass(false)}
        >
          Отмена
        </button>
      )}

      {emoteButton}
    </div>
  );
}
