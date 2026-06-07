import { useState, useEffect } from 'react';

function LandscapeBlocker() {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    function check() {
      const mobile = window.innerWidth < 768;
      const landscape = window.innerWidth > window.innerHeight;
      setIsLandscape(mobile && landscape);
    }
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  if (!isLandscape) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#1a1a2e',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', zIndex: 9999, color: '#e0e0e0',
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>↻</div>
      <p style={{ fontSize: 18, margin: 0 }}>Поверните телефон вертикально</p>
    </div>
  );
}
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { sendPartisansFirst } from '../../services/socket';
import { FACTION_COLORS } from '../../types/game';
import InfoBar from '../InfoBar/InfoBar';
import ScorePanel from '../ScorePanel/ScorePanel';
import PlayerBoard from '../PlayerBoard/PlayerBoard';
import WeatherBar from '../WeatherBar/WeatherBar';
import Hand from '../Hand/Hand';
import ActionBar from '../ActionBar/ActionBar';
import RowPicker from '../RowPicker/RowPicker';
import MedicPicker from '../MedicPicker/MedicPicker';
import RoundResult from '../RoundResult/RoundResult';
import GameOver from '../GameOver/GameOver';
import HandCard from '../HandCard/HandCard';
import CardImage from '../CardImage/CardImage';
import CardDetail from '../CardDetail/CardDetail';
import EmoteBubble from '../EmoteBubble/EmoteBubble';
import styles from './GameField.module.css';

export default function GameField() {
  const gs = useGameStore(s => s.gameState);
  const error = useGameStore(s => s.error);
  const showRowPicker = useGameStore(s => s.showRowPicker);
  const showMedicPicker = useGameStore(s => s.showMedicPicker);
  const showRoundResult = useGameStore(s => s.showRoundResult);
  const showGameOver = useGameStore(s => s.showGameOver);
  const showPartisansPrompt = useGameStore(s => s.showPartisansPrompt);
  const showInformantReveal = useGameStore(s => s.showInformantReveal);
  const informantCards = useGameStore(s => s.informantCards);
  const chooseInformant = useGameStore(s => s.chooseInformant);
  const showRootsMode = useGameStore(s => s.showRootsMode);
  const rootsMoves = useGameStore(s => s.rootsMoves);
  const submitRootsMoves = useGameStore(s => s.submitRootsMoves);
  const decoyTargetMode = useGameStore(s => s.decoyTargetMode);
  const handleDecoyTarget = useGameStore(s => s.handleDecoyTarget);
  const myStrength = useGameStore(s => s.myStrength);
  const oppStrength = useGameStore(s => s.oppStrength);
  const activeEmote = useGameStore(s => s.activeEmote);
  const detailCard = useGameStore(s => s.detailCard);
  const setDetailCard = useGameStore(s => s.setDetailCard);

  // Leader flash
  const [leaderFlash, setLeaderFlash] = useState<string | null>(null);

  // Watch for leader activation (leaderUsed changes)
  const leaderUsed = gs?.me.leaderUsed;
  const faction = gs?.me.faction;
  useEffect(() => {
    if (leaderUsed && faction) {
      setLeaderFlash(FACTION_COLORS[faction]);
      const timer = setTimeout(() => setLeaderFlash(null), 400);
      return () => clearTimeout(timer);
    }
  }, [leaderUsed, faction]);

  if (!gs) {
    return <div className={styles.noGame}>Ожидание подключения к игре...</div>;
  }

  const mStr = myStrength();
  const oStr = oppStrength();

  return (
    <div className={styles.gameField}>
      <LandscapeBlocker />
      {/* Leader activation flash overlay */}
      <AnimatePresence>
        {leaderFlash && (
          <motion.div
            initial={{ opacity: 0.15 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: leaderFlash,
              pointerEvents: 'none',
              zIndex: 500,
            }}
          />
        )}
      </AnimatePresence>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={styles.error}
        >
          {error}
        </motion.div>
      )}

      <InfoBar />

      <div className={styles.battlefield}>
        <div className={styles.boardSection}>
          <ScorePanel
            totalStrength={oStr.total}
            opponentStrength={mStr.total}
            roundsWon={gs.opponent.roundsWon}
            passed={gs.opponent.passed}
            player="opponent"
          />
          <div className={styles.boardRows}>
            <PlayerBoard
              player="opponent"
              field={gs.opponent.field}
              hornActive={gs.opponent.hornActive}
              weather={gs.weather}
              strength={oStr}
            />
          </div>
        </div>

        <WeatherBar weather={gs.weather} />

        <div className={styles.boardSection}>
          <ScorePanel
            totalStrength={mStr.total}
            opponentStrength={oStr.total}
            roundsWon={gs.me.roundsWon}
            passed={gs.me.passed}
            player="self"
          />
          <div className={styles.boardRows}>
            <PlayerBoard
              player="self"
              field={gs.me.field}
              hornActive={gs.me.hornActive}
              weather={gs.weather}
              strength={mStr}
              decoyTargetMode={decoyTargetMode}
              onDecoyTarget={decoyTargetMode ? handleDecoyTarget : undefined}
            />
          </div>
        </div>
      </div>

      <Hand />
      <ActionBar />

      <AnimatePresence>
        {showRootsMode && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={styles.rootsOverlay}
          >
            <span className={styles.rootsText}>
              Корни Тунграда: выберите до 2 карт для перемещения ({rootsMoves.length}/2)
            </span>
            <button className={styles.rootsBtn} onClick={submitRootsMoves}>
              Подтвердить
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRowPicker && <RowPicker />}
      </AnimatePresence>
      <AnimatePresence>
        {showMedicPicker && <MedicPicker />}
      </AnimatePresence>
      <AnimatePresence>
        {showRoundResult && <RoundResult />}
      </AnimatePresence>
      <AnimatePresence>
        {showGameOver && <GameOver />}
      </AnimatePresence>

      <AnimatePresence>
        {showPartisansPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.partisansOverlay}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25, ease: 'backOut' }}
              className={styles.partisansModal}
            >
              <div className={styles.partisansTitle}>Вы ходите первым?</div>
              <div className={styles.partisansBtns}>
                <button className={styles.partisansBtn} onClick={() => {
                  sendPartisansFirst(true);
                  useGameStore.getState().setPartisansPrompt(false);
                }}>Да</button>
                <button className={styles.partisansBtn} onClick={() => {
                  sendPartisansFirst(false);
                  useGameStore.getState().setPartisansPrompt(false);
                }}>Нет</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeEmote && (
          <EmoteBubble
            key={`${activeEmote.playerIndex}-${activeEmote.emoteId}`}
            emoteId={activeEmote.emoteId}
            faction={activeEmote.faction}
            position={activeEmote.playerIndex === gs.myIndex ? 'bottom' : 'top'}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInformantReveal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.informantOverlay}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, ease: 'backOut' }}
              className={styles.informantModal}
            >
              <div className={styles.informantTitle}>Карты противника — выберите одну для сброса</div>
              <div className={styles.informantCards}>
                {informantCards.map((card, i) => (
                  <motion.div
                    key={card.id}
                    className={styles.informantCardWrap}
                    initial={{ y: -100, opacity: 0, rotate: 0, scale: 0.5 }}
                    animate={{
                      y: 0,
                      opacity: 1,
                      rotate: informantCards.length === 3 ? [-5, 0, 5][i] : 0,
                      scale: 1,
                    }}
                    transition={{ duration: 0.35, delay: i * 0.1 }}
                    onClick={() => chooseInformant(card.id)}
                  >
                    <CardImage cardId={card.id} name={card.name} faction={card.faction} size="large" />
                    <div className={styles.informantCardName}>{card.name} ({card.strength})</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailCard && (
          <CardDetail card={detailCard} onClose={() => setDetailCard(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
