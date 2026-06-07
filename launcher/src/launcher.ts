// Тафт: standalone exe-лаунчер.
// Мастер запускает Taft.exe, видит ссылку, скидывает игрокам, закрывает окно.
//
// Архитектура:
//   - express + socket.io поднимаются in-process (как в taft-server)
//   - Игровая логика переиспользуется из taft-server/src (бандлится esbuild-ом)
//   - Cloudflare Quick Tunnel (cloudflared) — без регистрации, без токена
//   - Статика клиента кладётся в pkg-assets (public/**/*) и читается из snapshot

import fs from 'fs';
import http from 'http';
import path from 'path';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';

// Игровое ядро — относительный импорт, esbuild всё забандлит
import { RoomManager } from '../../taft-server/src/rooms/manager.js';
import { setupSocketHandlers } from '../../taft-server/src/socket/handlers.js';

// ═══════════════════════════════════════════
//  Конфигурация
// ═══════════════════════════════════════════

const PORT = 3000;

const isPkg = typeof (process as unknown as { pkg?: unknown }).pkg !== 'undefined';
const EXE_DIR = isPkg
  ? path.dirname(process.execPath)
  : path.dirname(process.argv[1] || process.execPath);

// ═══════════════════════════════════════════
//  Извлечение cloudflared.exe из pkg snapshot
// ═══════════════════════════════════════════
//
// pkg хранит ассеты внутри виртуальной FS. Windows не умеет spawn-ить
// оттуда — копируем бинарник на реальный диск при первом запуске.

function extractCloudflaredBinary(): string {
  const binName = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  const targetDir = path.join(EXE_DIR, '.taft-cf');
  const targetBin = path.join(targetDir, binName);

  if (isPkg) {
    // __dirname внутри pkg = /snapshot/<pkg>/dist
    const snapshotBin = path.join(
      __dirname,
      '..',
      'node_modules',
      'cloudflared',
      'bin',
      binName
    );
    try {
      fs.mkdirSync(targetDir, { recursive: true });
      const snapshotSize = fs.statSync(snapshotBin).size;
      let needsCopy = true;
      try {
        needsCopy = fs.statSync(targetBin).size !== snapshotSize;
      } catch {
        // нет файла — скопируем
      }
      if (needsCopy) {
        fs.copyFileSync(snapshotBin, targetBin);
        if (process.platform !== 'win32') fs.chmodSync(targetBin, 0o755);
      }
      return targetBin;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Не удалось извлечь cloudflared: ${msg}`);
    }
  }

  // Dev-режим: бинарник лежит в node_modules
  const devBin = path.join(
    __dirname,
    '..',
    '..',
    'launcher',
    'node_modules',
    'cloudflared',
    'bin',
    binName
  );
  if (fs.existsSync(devBin)) return devBin;

  // Fallback: пакет cloudflared знает свой путь
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DEFAULT_CLOUDFLARED_BIN } = require('cloudflared') as {
    DEFAULT_CLOUDFLARED_BIN: string;
  };
  return DEFAULT_CLOUDFLARED_BIN;
}

// ═══════════════════════════════════════════
//  Консольный UI
// ═══════════════════════════════════════════

function clearScreen() {
  process.stdout.write('\x1Bc');
}

function showBanner() {
  clearScreen();
  console.log('');
  console.log('  +========================================+');
  console.log('  |                                        |');
  console.log('  |        ТАФТ: Карты Альбарадура         |');
  console.log('  |                                        |');
  console.log('  +========================================+');
  console.log('');
}

function showStatus(message: string) {
  console.log(`  [*] ${message}`);
}

function showSuccess(message: string) {
  console.log(`  [+] ${message}`);
}

function showError(message: string) {
  console.error(`  [!] ${message}`);
}

function showLink(url: string) {
  // URL от trycloudflare.com может быть до 60+ символов.
  // Делаем рамку шириной 66 символов, чтобы URL влезал целиком.
  const W = Math.max(64, url.length + 4);
  const inner = W - 2;
  const bar = '  +' + '-'.repeat(W) + '+';
  const empty = '  |' + ' '.repeat(W) + '|';
  const line = (s: string) => '  |  ' + s.padEnd(W - 4) + '  |';

  console.log('');
  console.log(bar);
  console.log(empty);
  console.log(line('Ссылка для игроков:'));
  console.log(empty);
  console.log(line(url));
  console.log(empty);
  console.log(line('Отправьте эту ссылку игрокам.'));
  console.log(line('Один создаёт комнату, второй вводит код.'));
  console.log(empty);
  console.log(line('Закройте окно чтобы остановить.'));
  console.log(empty);
  console.log(bar);
  console.log('');
  // Дублируем URL в обычном тексте — удобно скопировать мышью
  console.log(`  ${url}`);
  console.log('');
  // Подавляем неиспользуемую переменную
  void inner;
}

// ═══════════════════════════════════════════
//  Буфер обмена
// ═══════════════════════════════════════════

function copyToClipboard(text: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { execSync } = require('child_process') as typeof import('child_process');
    if (process.platform === 'win32') {
      const tmp = path.join(EXE_DIR, '.taft-clip.tmp');
      fs.writeFileSync(tmp, text, 'utf8');
      execSync(`type "${tmp}" | clip`, { stdio: 'pipe', shell: 'cmd.exe' });
      fs.unlinkSync(tmp);
      return true;
    }
    if (process.platform === 'darwin') {
      execSync(`printf %s "${text.replace(/"/g, '\\"')}" | pbcopy`, { stdio: 'pipe' });
      return true;
    }
    execSync(`printf %s "${text.replace(/"/g, '\\"')}" | xclip -selection clipboard`, {
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════
//  Туннели: localtunnel (первый) → cloudflared (запасной)
// ═══════════════════════════════════════════

interface ActiveTunnel {
  stop(): void;
}

let activeTunnel: ActiveTunnel | null = null;

// ── localtunnel ──────────────────────────────
// Чистый Node.js — не нужен бинарник, нет Cloudflare-проверки браузера.

async function startLocaltunnel(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const lt = require('localtunnel') as (opts: { port: number }) => Promise<{
    url: string;
    close(): void;
    on(event: string, cb: (err?: Error) => void): void;
  }>;

  const tunnel = await lt({ port: PORT });
  activeTunnel = { stop: () => tunnel.close() };

  // Логируем ошибки туннеля, не падаем насмерть
  tunnel.on('error', (err) => {
    const msg = err instanceof Error ? err.message : String(err);
    showError(`Туннель: ${msg}`);
  });

  return tunnel.url;
}

// ── cloudflared (запасной) ────────────────────

interface CloudflaredTunnel {
  stop: () => void;
  on(event: 'url', cb: (url: string) => void): this;
  on(event: 'error', cb: (err: Error) => void): this;
}

async function startCloudflaredTunnel(cfBin: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cf = require('cloudflared') as {
    Tunnel: new (args: string[]) => CloudflaredTunnel;
    use: (bin: string) => void;
  };

  cf.use(cfBin);

  return new Promise<string>((resolve, reject) => {
    // Форсируем HTTP/2 — QUIC (UDP) блокируется на многих VPN/роутерах.
    const args = ['tunnel', '--url', `http://localhost:${PORT}`, '--protocol', 'http2'];
    const t = new cf.Tunnel(args);
    activeTunnel = t;

    const timer = setTimeout(() => {
      t.stop();
      reject(new Error('Таймаут ожидания ссылки от cloudflared (60 сек)'));
    }, 60_000);

    t.on('url', (url) => { clearTimeout(timer); resolve(url); });
    t.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

// ═══════════════════════════════════════════
//  Основной процесс
// ═══════════════════════════════════════════

async function main() {
  showBanner();
  showStatus('Запуск сервера...');

  const app = express();
  app.use(cors());
  app.use(compression());

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  const roomManager = new RoomManager();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', rooms: roomManager.getRoomCount() });
  });

  const publicPath = resolvePublicPath();
  if (!fs.existsSync(path.join(publicPath, 'index.html'))) {
    showError(`Не найден клиент: ${path.join(publicPath, 'index.html')}`);
    showError('Сборка повреждена. Перекачайте Taft.exe.');
    waitAndExit(1);
    return;
  }

  app.use(
    express.static(publicPath, {
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );

  app.get('*', (req, res, next) => {
    if (req.path === '/health' || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(publicPath, 'index.html'), (err) => {
      if (err) next();
    });
  });

  setupSocketHandlers(io, roomManager);

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          showError(`Порт ${PORT} занят. Закройте другую копию Taft.exe и попробуйте снова.`);
        } else {
          showError(`Ошибка запуска: ${err.message}`);
        }
        reject(err);
      });
      server.listen(PORT, () => resolve());
    });
  } catch {
    waitAndExit(1);
    return;
  }

  showSuccess(`Сервер запущен на порту ${PORT}`);

  // ── Туннель: cloudflared → localtunnel → локальный fallback ──
  showStatus('Создание публичной ссылки (Cloudflare)...');

  let publicUrl: string | undefined;

  // Попытка 1: cloudflared (стабильнее, не нужна регистрация)
  try {
    const cfBin = extractCloudflaredBinary();
    publicUrl = await startCloudflaredTunnel(cfBin);
  } catch (cfErr) {
    const cfMsg = cfErr instanceof Error ? cfErr.message : String(cfErr);
    showError(`cloudflared: ${cfMsg}`);
    showStatus('Попытка через localtunnel...');

    // Попытка 2: localtunnel
    try {
      publicUrl = await startLocaltunnel();
    } catch (ltErr) {
      const ltMsg = ltErr instanceof Error ? ltErr.message : String(ltErr);
      showError('Не удалось создать публичную ссылку.');
      showError(`Причина: ${ltMsg}`);
      console.log('');
      console.log('  Возможные причины:');
      console.log('  - Нет интернета');
      console.log('  - Антивирус блокирует cloudflared.exe');
      console.log('  - trycloudflare.com недоступен из вашей сети');
      showLocalFallback(server);
      return;
    }
  }

  showSuccess('Ссылка создана!');
  if (copyToClipboard(publicUrl!)) {
    showSuccess('Ссылка скопирована в буфер обмена.');
  }
  showLink(publicUrl!);

  io.on('connection', (socket) => {
    updateConnectionLine(io);
    socket.on('disconnect', () => updateConnectionLine(io));
  });

  waitForClose(server);
}

function showLocalFallback(server: http.Server) {
  console.log('');
  console.log(`  Сервер работает локально: http://localhost:${PORT}`);
  console.log('  Игроки в одной Wi-Fi сети могут зайти по вашему IP.');
  console.log('');
  console.log('  Закройте окно чтобы остановить сервер.');
  waitForClose(server);
}

function resolvePublicPath(): string {
  const candidates = [
    path.join(__dirname, '..', 'public'),
    path.join(EXE_DIR, 'public'),
    path.resolve('public'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'index.html'))) return c;
  }
  return candidates[0];
}

function updateConnectionLine(io: SocketIOServer) {
  const n = io.engine.clientsCount;
  process.stdout.write(`\r  Подключений: ${n}    `);
}

// ═══════════════════════════════════════════
//  Завершение
// ═══════════════════════════════════════════

let shuttingDown = false;

function waitForClose(server: http.Server) {
  process.on('SIGINT', () => shutdown(server));
  process.on('SIGTERM', () => shutdown(server));
  if (process.platform === 'win32') {
    process.on('SIGHUP', () => shutdown(server));
  }
  setInterval(() => {}, 60_000);
}

function shutdown(server: http.Server) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n');
  showStatus('Остановка...');

  try {
    activeTunnel?.stop();
  } catch {
    // tunnel может быть не активен
  }

  const forceTimer = setTimeout(() => process.exit(0), 3000);
  server.close(() => {
    clearTimeout(forceTimer);
    showSuccess('Сервер остановлен. До встречи!');
    process.exit(0);
  });
}

function waitAndExit(code = 0) {
  console.log('\n  Нажмите Enter чтобы закрыть...');
  process.stdin.resume();
  process.stdin.once('data', () => process.exit(code));
}

// ═══════════════════════════════════════════
//  Старт
// ═══════════════════════════════════════════

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  showError(`Критическая ошибка: ${msg}`);
  waitAndExit(1);
});
