import { useGameStore } from '../../store/gameStore';
import type { CardRow } from '../../types/game';
import { ROW_LABELS } from '../../types/game';
import styles from './RowPicker.module.css';

const ROWS: CardRow[] = ['melee', 'ranged', 'siege'];

export default function RowPicker() {
  const gs = useGameStore(s => s.gameState);
  const rowPickerContext = useGameStore(s => s.rowPickerContext);
  const playSelectedCard = useGameStore(s => s.playSelectedCard);
  const activateLeader = useGameStore(s => s.activateLeader);
  const addRootsMove = useGameStore(s => s.addRootsMove);
  const selectedCardId = useGameStore(s => s.selectedCardId);
  const closeRowPicker = useGameStore(s => s.closeRowPicker);
  const myStrength = useGameStore(s => s.myStrength);

  if (!gs) return null;
  const str = myStrength();

  const handlePick = (row: CardRow) => {
    if (rowPickerContext === 'leader_rally' || rowPickerContext === 'leader_curse') {
      activateLeader({ targetRow: row });
      closeRowPicker();
    } else if (rowPickerContext === 'roots' && selectedCardId) {
      addRootsMove(selectedCardId, row);
      closeRowPicker();
    } else {
      playSelectedCard(row);
    }
  };

  return (
    <div className={styles.overlay} onClick={closeRowPicker}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.title}>Выберите ряд</div>
        <div className={styles.rows}>
          {ROWS.map(row => (
            <button key={row} className={styles.rowBtn} onClick={() => handlePick(row)}>
              <span>{ROW_LABELS[row]}</span>
              <span className={styles.rowStrength}>Сила: {str[row]}</span>
            </button>
          ))}
        </div>
        <button className={styles.cancelBtn} onClick={closeRowPicker}>Отмена</button>
      </div>
    </div>
  );
}
