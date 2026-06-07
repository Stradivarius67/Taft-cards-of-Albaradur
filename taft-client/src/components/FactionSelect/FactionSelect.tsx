import { useLobbyStore } from '../../store/lobbyStore';
import { FACTION_NAMES } from '../../types/game';
import type { FactionId } from '../../types/game';
import FactionCard from '../FactionCard/FactionCard';
import { preloadFactionCards } from '../../utils/cardArt';
import styles from './FactionSelect.module.css';

// Папки в src/assets/cards/optimized
const FACTION_FOLDERS: Record<FactionId, string> = {
  lion_guard: 'lion_guard',
  imperial_dogs: 'imperial_dogs',
  litlad_partisans: 'litlad_partisans',
  grey_rangers: 'grey_rangers',
  vexitar_witches: 'vexitar_witches',
};

const FACTIONS: {
  id: FactionId;
  name: string;
  leader: string;
  leaderId: string;
  passive: string;
  leaderAbility: string;
  description: string;
  color: string;
}[] = [
  {
    id: 'lion_guard',
    name: 'Львиная гвардия',
    leader: 'Хальгер Бротен, Король-лев',
    leaderId: 'leader_halgerd',
    passive: 'При победе в раунде — тянет 1 карту',
    leaderAbility: 'Сплочение гвардии: +2 к силе всех карт в ряду',
    description: 'Синергия и сплочённость. Bond и morale.',
    color: '#D4A843',
  },
  {
    id: 'imperial_dogs',
    name: 'Имперские псы',
    leader: 'Граф Торвус Фердинанд Белаторес',
    leaderId: 'leader_torvus',
    passive: 'Побеждают при ничьей в раунде',
    leaderAbility: 'Осведомитель: подсмотри 3 карты врага, сбрось одну',
    description: 'Шпионаж и хитрость. Много шпионов.',
    color: '#C0392B',
  },
  {
    id: 'litlad_partisans',
    name: 'Литладские партизаны',
    leader: 'Жизнедерево Тунграда',
    leaderId: 'leader_lifetree',
    passive: 'Выбирают кто ходит первым каждый раунд',
    leaderAbility: 'Корни Тунграда: переместите до 2 карт между рядами',
    description: 'Гибкость и адаптивность. Карты в любой ряд.',
    color: '#27AE60',
  },
  {
    id: 'grey_rangers',
    name: 'Серые следопыты',
    leader: 'Первый Следопыт',
    leaderId: 'leader_first',
    passive: '1 случайная карта остаётся между раундами',
    leaderAbility: 'Кровавый ритуал: верни сильнейшую карту из сброса',
    description: 'Грубая сила. Самые мощные карты в игре.',
    color: '#7F8C8D',
  },
  {
    id: 'vexitar_witches',
    name: 'Векситарские ведьмы',
    leader: 'Гризельда Вечная',
    leaderId: 'leader_griszelda',
    passive: 'Ведьминский пакт: тянет верхнюю карту колоды в начале раунда',
    leaderAbility: 'Проклятие Гризельды: -2 к силе всех карт в ряду противника',
    description: 'Контроль и манипуляция. Демоны, вампиры, кошмары.',
    color: '#6C3483',
  },
];

export default function FactionSelect() {
  const { selectedFaction, factionConfirmed, opponentReady, error, goHome } = useLobbyStore();
  const selectFaction = useLobbyStore(s => s.selectFaction);
  const confirmFaction = useLobbyStore(s => s.confirmFaction);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Выберите фракцию</h2>

      <div className={styles.grid}>
        {FACTIONS.map(f => (
          <FactionCard
            key={f.id}
            name={f.name}
            leader={f.leader}
            leaderId={f.leaderId}
            faction={f.id}
            passive={f.passive}
            leaderAbility={f.leaderAbility}
            description={f.description}
            color={f.color}
            isSelected={selectedFaction === f.id}
            isDisabled={factionConfirmed && selectedFaction !== f.id}
            onClick={() => {
              selectFaction(f.id);
              // Прогреваем кэш браузера сразу после выбора, чтобы карты
              // успели догрузиться по медленному ngrok-туннелю.
              preloadFactionCards(FACTION_FOLDERS[f.id]);
              preloadFactionCards('leaders');
            }}
          />
        ))}
      </div>

      {selectedFaction && !factionConfirmed && (
        <button className={styles.confirmBtn} onClick={confirmFaction}>
          Подтвердить
        </button>
      )}

      {factionConfirmed && (
        <span className={styles.confirmed}>
          Вы выбрали: {FACTION_NAMES[selectedFaction!]}.
          {opponentReady ? ' Противник тоже выбрал!' : ' Ожидание противника...'}
        </span>
      )}

      {!factionConfirmed && (
        <span className={styles.status}>
          {opponentReady ? 'Противник уже выбрал фракцию' : 'Противник выбирает...'}
        </span>
      )}

      {error && <span className={styles.error}>{error}</span>}

      <button className={styles.cancelBtn} onClick={goHome}>
        На главную
      </button>
    </div>
  );
}
