// Используем оптимизированные WebP (см. scripts/optimize-cards.mjs).
// Originals остаются как мастер-источник, но в бандл их не тянем.
const cardImages = import.meta.glob<{ default: string }>(
  '../assets/cards/optimized/**/*.webp',
  { eager: true }
);

const imageCache = new Map<string, string>();
const factionIndex = new Map<string, string[]>();
for (const [filePath, module] of Object.entries(cardImages)) {
  const filename = filePath.split('/').pop()?.replace(/\.webp$/, '');
  if (!filename) continue;
  imageCache.set(filename, module.default);
  // Префикс = код фракции (lg, id, gr, lp), либо 'leaders' для папки лидеров
  const parts = filePath.split('/');
  const folder = parts[parts.length - 2] ?? '';
  const list = factionIndex.get(folder) ?? [];
  list.push(module.default);
  factionIndex.set(folder, list);
}

/** Strip p0_/p1_ prefix and trailing _N suffix: p0_lg_musketeer_1 → lg_musketeer */
function getBaseCardName(cardId: string): string {
  let name = cardId.replace(/^p\d_/, '');
  name = name.replace(/_\d+$/, '');
  return name;
}

export function getCardImageUrl(cardId: string): string | null {
  return imageCache.get(getBaseCardName(cardId)) ?? null;
}

export function getLeaderImageUrl(leaderId: string): string | null {
  return imageCache.get(leaderId) ?? null;
}

/**
 * Префетчит все карты выбранной фракции, чтобы во время игры спрайты
 * уже лежали в браузерном кэше. Вызывается после выбора фракции в меню.
 *
 * @param factionFolder — имя папки в src/assets/cards/optimized:
 *   'lion_guard' | 'imperial_dogs' | 'grey_rangers' | 'litlad_partisans'
 *   плюс 'leaders' для общих лидеров.
 */
export function preloadFactionCards(factionFolder: string): void {
  const urls = factionIndex.get(factionFolder);
  if (!urls) return;
  for (const url of urls) {
    const img = new Image();
    img.src = url;
  }
}
