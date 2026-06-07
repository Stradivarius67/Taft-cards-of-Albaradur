// Готовит файлы перед упаковкой в exe.
//
// Копирует билд клиента (taft-client/dist) в launcher/public —
// эта папка потом уходит в pkg-assets (см. package.json → "pkg.assets").
//
// Серверный код копировать не нужно: esbuild бандлит его из
// taft-server/src напрямую в dist/bundle.cjs.

const fs = require('fs');
const path = require('path');

const LAUNCHER_DIR = path.join(__dirname, '..');
const CLIENT_DIST = path.join(LAUNCHER_DIR, '..', 'taft-client', 'dist');
const TARGET_PUBLIC = path.join(LAUNCHER_DIR, 'public');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Подготовка бандла...');

if (!fs.existsSync(CLIENT_DIST)) {
  console.error(`  [!] Клиент не собран: ${CLIENT_DIST}`);
  console.error('      Запустите: npm run build --prefix ../taft-client');
  process.exit(1);
}

if (fs.existsSync(TARGET_PUBLIC)) {
  fs.rmSync(TARGET_PUBLIC, { recursive: true, force: true });
}
copyDir(CLIENT_DIST, TARGET_PUBLIC);

const fileCount = countFiles(TARGET_PUBLIC);
console.log(`  [+] Клиент скопирован в public/ (${fileCount} файлов)`);
console.log('  [+] Готово');

function countFiles(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) n += countFiles(path.join(dir, entry.name));
    else n += 1;
  }
  return n;
}
