import type { Card, CardRow, PlayerField, HornState, WeatherEffects, StrengthInfo } from '../../types/game';
import Row from '../Row/Row';
import styles from './PlayerBoard.module.css';

interface Props {
  player: 'self' | 'opponent';
  field: PlayerField;
  hornActive: HornState;
  weather: WeatherEffects;
  strength: StrengthInfo;
  onRowClick?: (row: CardRow) => void;
  decoyTargetMode?: boolean;
  onDecoyTarget?: (cardId: string) => void;
}

const SELF_ORDER: CardRow[] = ['melee', 'ranged', 'siege'];
const OPP_ORDER: CardRow[] = ['siege', 'ranged', 'melee'];

const WEATHER_MAP: Record<CardRow, keyof WeatherEffects> = {
  melee: 'frost',
  ranged: 'fog',
  siege: 'rain',
};

export default function PlayerBoard({
  player, field, hornActive, weather, strength,
  onRowClick, decoyTargetMode, onDecoyTarget,
}: Props) {
  const order = player === 'self' ? SELF_ORDER : OPP_ORDER;
  const isSelf = player === 'self';

  return (
    <div className={styles.board}>
      {order.map(rowType => (
        <Row
          key={rowType}
          rowType={rowType}
          cards={field[rowType]}
          isWeatherActive={weather[WEATHER_MAP[rowType]]}
          isHornActive={hornActive[rowType]}
          strength={strength[rowType]}
          isSelf={isSelf}
          onClick={isSelf && onRowClick ? () => onRowClick(rowType) : undefined}
          decoyTargetMode={isSelf && decoyTargetMode}
          onCardClick={isSelf && onDecoyTarget ? onDecoyTarget : undefined}
        />
      ))}
    </div>
  );
}
