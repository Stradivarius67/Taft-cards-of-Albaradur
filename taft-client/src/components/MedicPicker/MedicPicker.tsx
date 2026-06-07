import { useGameStore } from '../../store/gameStore';
import CardImage from '../CardImage/CardImage';
import { ABILITY_LABELS } from '../../types/game';
import styles from './MedicPicker.module.css';

export default function MedicPicker() {
  const medicCards = useGameStore(s => s.medicCards);
  const chooseMedic = useGameStore(s => s.chooseMedic);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.title}>Выберите карту для воскрешения</div>
        <div className={styles.cards}>
          {medicCards.map(card => (
            <div key={card.id} className={styles.cardWrap} onClick={() => chooseMedic(card.id)}>
              <CardImage cardId={card.id} name={card.name} faction={card.faction} size="large" />
              <div className={styles.cardInfo}>
                <span className={styles.cardName}>{card.name}</span>
                <span className={styles.cardStr}>{card.strength}</span>
                {card.ability !== 'none' && (
                  <span className={styles.cardAbility}>{ABILITY_LABELS[card.ability]}</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <button className={styles.skipBtn} onClick={() => chooseMedic(null)}>
          Пропустить
        </button>
      </div>
    </div>
  );
}
