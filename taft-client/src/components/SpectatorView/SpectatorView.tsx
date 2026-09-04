import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { disconnect } from '../../services/socket';
import { FACTION_NAMES, FACTION_COLORS, ROW_LABELS } from '../../types/game';
import type { SpectatorPlayerView, SpectatorGameState, CardRow, StrengthInfo, Card } from '../../types/game';
import Row from '../Row/Row';
import WeatherBar from '../WeatherBar/WeatherBar';
import RoundResult from '../RoundResult/RoundResult';
import GameOver from '../GameOver/GameOver';
import HandCard from '../HandCard/HandCard';
import EmoteBubble from '../EmoteBubble/EmoteBubble';
import CardDetail from '../CardDetail/CardDetail';
import styles from './SpectatorView.module.css';

function SpectatorBoard({ player, strength, isCurrentTurn, label }: {
  player: SpectatorPlayerView;
  strength: StrengthInfo;
  isCurrentTurn: boolean;
  label: string;
}) {
  return (
    <div className={`${styles.board} ${isCurrentTurn ? styles.activeTurn : ''}`}>
      <div className={styles.boardHeader}>
        <span className={styles.playerLabel} style={{ color: FACTION_COLORS[player.faction] }}>
          {label}: {FACTION_NAMES[player.faction]}
        </span>
        <span className={styles.totalStrength}>{strength.total}</span>
        {player.passed && <span className={styles.passedBadge}>ПАС</span>}
      </div>
      <div className={styles.boardMeta}>
        <span>Карт: {player.handCount}</span>
        <span>Колода: {player.deckCount}</span>
        <span>Лидер: {player.leaderUsed ? 'использован' : 'доступен'}</span>
      </div>
      <div className={styles.rows}>
        {(['siege', 'ranged', 'melee'] as CardRow[]).map(rowType => (
          <Row
            key={rowType}
            rowType={rowType}
            cards={player.field[rowType]}
            isWeatherActive={
              (rowType === 'melee' && false) || // weather is shown separately
              false
            }
            isHornActive={player.hornActive[rowType]}
            strength={strength[rowType]}
            isSelf={false}
          />
        ))}
      </div>
      {/* Open hands mode */}
      {player.hand && player.hand.length > 0 && (
        <details className={styles.handDetails}>
          <summary className={styles.handSummary}>Рука {label} ({player.hand.length} карт)</summary>
          <div className={styles.handCards}>
            {player.hand.map(card => (
              <HandCard key={card.id} card={card} isSelected={false} canPlay={false} onClick={() => {}} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function SpectatorLog({ logs }: { logs: string[] }) {
  const recent = logs.slice(-8);
  return (
    <div className={styles.log}>
      {recent.map((entry, i) => (
        <div key={i} className={styles.logEntry}>{entry}</div>
      ))}
    </div>
  );
}

export default function SpectatorView() {
  const spectatorState = useGameStore(s => s.spectatorState);
  const showRoundResult = useGameStore(s => s.showRoundResult);
  const showGameOver = useGameStore(s => s.showGameOver);
  const error = useGameStore(s => s.error);
  const activeEmote = useGameStore(s => s.activeEmote);
  const detailCard = useGameStore(s => s.detailCard);
  const setDetailCard = useGameStore(s => s.setDetailCard);

  if (!spectatorState) {
    return <div className={styles.loading}>Подключение к матчу...</div>;
  }

  const gs = spectatorState;
  const roundDots = [1, 2, 3].map(r => {
    if (r < gs.round) return 'done';
    if (r === gs.round) return 'current';
    return 'future';
  });

  const currentPlayerLabel = gs.currentPlayerIndex === 0 ? 'Игрок 1' : 'Игрок 2';
  const currentFaction = gs.currentPlayerIndex === 0 ? gs.player1.faction : gs.player2.faction;

  return (
    <div className={styles.spectatorView}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <span className={styles.spectatorLabel}>Наблюдатель</span>
        <span className={styles.roundInfo}>
          Раунд {gs.round}/3
          <span className={styles.roundDots}>
            {roundDots.map((d, i) => (
              <span key={i} className={`${styles.dot} ${styles[d]}`} />
            ))}
          </span>
        </span>
        <span className={styles.roundWins}>
          {gs.player1.roundsWon} — {gs.player2.roundsWon}
        </span>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Boards side by side */}
      <div className={styles.boards}>
        <SpectatorBoard
          player={gs.player1}
          strength={gs.strength.player1}
          isCurrentTurn={gs.currentPlayerIndex === 0 && gs.phase === 'playing'}
          label="Игрок 1"
        />
        <div className={styles.center}>
          <WeatherBar weather={gs.weather} />
        </div>
        <SpectatorBoard
          player={gs.player2}
          strength={gs.strength.player2}
          isCurrentTurn={gs.currentPlayerIndex === 1 && gs.phase === 'playing'}
          label="Игрок 2"
        />
      </div>

      {/* Current turn indicator */}
      <div className={styles.turnBar}>
        <span className={styles.turnIndicator}>
          {gs.phase === 'playing' ? (
            <>Ход: <strong style={{ color: FACTION_COLORS[currentFaction] }}>{currentPlayerLabel} ({FACTION_NAMES[currentFaction]})</strong></>
          ) : gs.phase === 'game_over' ? (
            'Матч завершён'
          ) : (
            `Фаза: ${gs.phase}`
          )}
        </span>
      </div>

      {/* Log */}
      <SpectatorLog logs={gs.log} />

      <AnimatePresence>
        {activeEmote && (
          <EmoteBubble
            key={`${activeEmote.playerIndex}-${activeEmote.emoteId}`}
            emoteId={activeEmote.emoteId}
            faction={activeEmote.faction}
            position={activeEmote.playerIndex === 0 ? 'left' : 'right'}
          />
        )}
      </AnimatePresence>

      {/* Overlays */}
      <AnimatePresence>
        {showRoundResult && <RoundResult />}
      </AnimatePresence>
      <AnimatePresence>
        {showGameOver && <SpectatorGameOver />}
      </AnimatePresence>
      <AnimatePresence>
        {detailCard && (
          <CardDetail card={detailCard} onClose={() => setDetailCard(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function SpectatorGameOver() {
  const result = useGameStore(s => s.gameOverResult);
  if (!result) return null;

  const { won, myRounds, opponentRounds } = result;
  // For spectators, won is based on player 1
  const titleText = won === true ? 'Игрок 1 победил!' : won === false ? 'Игрок 2 победил!' : 'Ничья';

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.modalTitle}>{titleText}</div>
        <div className={styles.modalScore}>Раунды: {myRounds} — {opponentRounds}</div>
        <button className={styles.modalBtn} onClick={() => { disconnect(); window.location.reload(); }}>
          Вернуться на главную
        </button>
      </div>
    </div>
  );
}
