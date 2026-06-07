// Конвертирует исходные PNG карт в оптимизированные WebP.
// Запуск: node scripts/optimize-cards.mjs
// Источник: src/assets/cards/originals/<faction>/<file>.png
// Результат: src/assets/cards/optimized/<faction>/<file>.webp
//
// Размер подобран так, чтобы покрыть retina-отображение детали карты
// (~640px CSS × 2 = 1280px), но при этом сильно снизить вес.

import { readdir, mkdir, stat } from 'node:fs/promises';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC_DIR = join(ROOT, 'src/assets/cards/originals');
const OUT_DIR = join(ROOT, 'src/assets/cards/optimized');

const TARGET_WIDTH = 800;
const QUALITY = 78;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

async function main() {
  let processed = 0;
  let skipped = 0;
  let totalIn = 0;
  let totalOut = 0;

  for await (const file of walk(SRC_DIR)) {
    if (!/\.png$/i.test(file)) continue;
    const rel = relative(SRC_DIR, file).replace(/\.png$/i, '.webp');
    const out = join(OUT_DIR, rel);
    await mkdir(dirname(out), { recursive: true });

    const srcStat = await stat(file);
    totalIn += srcStat.size;

    let needsRebuild = true;
    try {
      const outStat = await stat(out);
      if (outStat.mtimeMs >= srcStat.mtimeMs) {
        needsRebuild = false;
        totalOut += outStat.size;
        skipped += 1;
      }
    } catch {
      // нет файла — собираем
    }

    if (needsRebuild) {
      await sharp(file)
        .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(out);
      const outStat = await stat(out);
      totalOut += outStat.size;
      processed += 1;
      const ratio = ((1 - outStat.size / srcStat.size) * 100).toFixed(0);
      console.log(`  ${rel}  ${(outStat.size / 1024).toFixed(0)}KB  (-${ratio}%)`);
    }
  }

  const inMB = (totalIn / 1024 / 1024).toFixed(1);
  const outMB = (totalOut / 1024 / 1024).toFixed(1);
  const total = processed + skipped;
  console.log(
    `\nГотово: ${processed} собрано, ${skipped} пропущено (актуальны).`
  );
  console.log(`Всего: ${total} файлов  ${inMB}MB → ${outMB}MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
