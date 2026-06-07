// Один-в-одном лаунчер для онлайн-партии:
//   1. Собирает клиент и кладёт его в taft-server/public.
//   2. Запускает сервер на порту 3000.
//   3. Поднимает ngrok http 3000.
//   4. Достаёт публичный URL из локального API ngrok (http://127.0.0.1:4040).
//   5. Кладёт ссылку в буфер обмена и печатает её крупно.
//
// Запуск: npm run host
// Остановка: Ctrl+C — корректно глушит и сервер, и ngrok.

import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const IS_WIN = process.platform === 'win32';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(tag, msg, color = C.cyan) {
  console.log(`${color}${C.bold}[${tag}]${C.reset} ${msg}`);
}

function err(msg) {
  console.error(`${C.red}${C.bold}[ОШИБКА]${C.reset} ${msg}`);
}

/** Запускает дочерний процесс наследуя stdio. Возвращает Promise<exitCode>. */
function runInherit(cmd, args, opts = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: IS_WIN,
      cwd: ROOT,
      ...opts,
    });
    child.on('error', rejectPromise);
    child.on('exit', (code) => {
      if (code === 0) resolvePromise(0);
      else rejectPromise(new Error(`${cmd} завершился с кодом ${code}`));
    });
  });
}

/** Проверяет, что ngrok установлен. */
function ngrokInstalled() {
  const probe = spawnSync(IS_WIN ? 'where' : 'which', ['ngrok'], {
    shell: IS_WIN,
  });
  return probe.status === 0;
}

/** Кладёт текст в буфер обмена кросс-платформенно. */
function copyToClipboard(text) {
  try {
    let cmd, args;
    if (IS_WIN) {
      cmd = 'powershell';
      args = ['-NoProfile', '-Command', `Set-Clipboard -Value '${text.replace(/'/g, "''")}'`];
    } else if (process.platform === 'darwin') {
      cmd = 'pbcopy';
      args = [];
    } else {
      cmd = 'xclip';
      args = ['-selection', 'clipboard'];
    }
    const child = spawnSync(cmd, args, { input: text, shell: false });
    return child.status === 0;
  } catch {
    return false;
  }
}

/** Опрашивает локальный API ngrok пока не получит публичный https URL. */
async function fetchNgrokUrl(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const res = await fetch('http://127.0.0.1:4040/api/tunnels');
      if (res.ok) {
        const data = await res.json();
        const tunnels = Array.isArray(data?.tunnels) ? data.tunnels : [];
        const https = tunnels.find((t) => t.public_url?.startsWith('https://'));
        if (https) return https.public_url;
      }
    } catch {
      // ngrok ещё не поднял API, ждём
    }
    await sleep(500);
  }
  return null;
}

let serverProc = null;
let ngrokProc = null;
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('host', 'Останавливаю сервер и ngrok…', C.yellow);
  if (ngrokProc && !ngrokProc.killed) {
    try {
      ngrokProc.kill('SIGTERM');
    } catch {}
  }
  if (serverProc && !serverProc.killed) {
    try {
      serverProc.kill('SIGTERM');
    } catch {}
  }
  // Дать процессам шанс остановиться чисто
  setTimeout(() => process.exit(code), 500);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function main() {
  log('host', 'Шаг 1/3 — сборка клиента…');
  await runInherit('npm', ['run', 'build']);

  if (!ngrokInstalled()) {
    err('ngrok не найден в PATH.');
    console.log(
      `${C.gray}Установите его с https://ngrok.com/download и повторите запуск.${C.reset}`
    );
    process.exit(1);
  }

  log('host', 'Шаг 2/3 — запускаю сервер на :3000…');
  serverProc = spawn('node', ['taft-server/dist/index.js'], {
    cwd: ROOT,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, PORT: '3000' },
    shell: false,
  });
  serverProc.on('exit', (code) => {
    if (!shuttingDown) {
      err(`Сервер неожиданно завершился (код ${code}).`);
      shutdown(1);
    }
  });

  // Дать серверу секунду подняться, чтобы ngrok сразу видел живой апстрим.
  await sleep(1000);

  log('host', 'Шаг 3/3 — поднимаю ngrok http 3000…');
  ngrokProc = spawn('ngrok', ['http', '3000', '--log=stdout'], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'ignore'],
    shell: IS_WIN,
  });
  ngrokProc.on('exit', (code) => {
    if (!shuttingDown) {
      err(`ngrok неожиданно завершился (код ${code}).`);
      shutdown(1);
    }
  });

  const url = await fetchNgrokUrl();
  if (!url) {
    err('Не удалось получить URL у ngrok за 15 секунд.');
    shutdown(1);
    return;
  }

  const copied = copyToClipboard(url);

  console.log('');
  console.log(`${C.green}${C.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
  console.log(`${C.green}${C.bold}  ИГРА ГОТОВА${C.reset}`);
  console.log(`${C.green}${C.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
  console.log('');
  console.log(`  ${C.bold}${url}${C.reset}`);
  console.log('');
  if (copied) {
    console.log(`  ${C.gray}(ссылка уже в буфере обмена)${C.reset}`);
  } else {
    console.log(`  ${C.yellow}(не получилось скопировать в буфер — скопируйте вручную)${C.reset}`);
  }
  console.log('');
  console.log(`  ${C.gray}Ctrl+C чтобы остановить.${C.reset}`);
  console.log('');
}

main().catch((e) => {
  err(e?.message ?? String(e));
  shutdown(1);
});
