// Собирает launcher.ts + весь импортируемый код taft-server
// в один CommonJS-файл dist/bundle.cjs, пригодный для pkg.
//
// Почему esbuild, а не tsc:
//   - taft-server написан в ESM (type: module в его package.json)
//   - pkg поддерживает CJS надёжнее всего
//   - esbuild умеет за один проход конвертнуть ESM → CJS и забандлить
//
// Нюанс: taft-server импортирует модули с .js-суффиксами
// (например '../rooms/manager.js'), а реальные файлы — .ts.
// esbuild сам такое не переписывает → добавлен резолвер-плагин.

const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

const LAUNCHER_DIR = path.join(__dirname, '..');
const ENTRY = path.join(LAUNCHER_DIR, 'src', 'launcher.ts');
const OUT = path.join(LAUNCHER_DIR, 'dist', 'bundle.cjs');

fs.mkdirSync(path.dirname(OUT), { recursive: true });

// Плагин: если относительный импорт '.../foo.js' не находится,
// пробуем '.../foo.ts'. Нужно для taft-server (ESM-style .js suffix в src).
const resolveJsToTs = {
  name: 'resolve-js-to-ts',
  setup(build) {
    build.onResolve({ filter: /\.js$/ }, (args) => {
      if (args.kind === 'entry-point') return null;
      if (!args.path.startsWith('.') && !path.isAbsolute(args.path)) return null;

      const absDir = args.resolveDir;
      const jsPath = path.resolve(absDir, args.path);
      if (fs.existsSync(jsPath)) return null; // обычный .js — пусть esbuild сам

      const tsPath = jsPath.replace(/\.js$/, '.ts');
      if (fs.existsSync(tsPath)) {
        return { path: tsPath };
      }
      return null;
    });
  },
};

console.log('Бандлинг launcher + taft-server через esbuild...');

esbuild
  .build({
    entryPoints: [ENTRY],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile: OUT,
    // Нативные/бинарные пакеты — оставляем внешними (pkg подтянет из node_modules).
    // bufferutil/utf-8-validate — optional deps socket.io; без них работает.
    external: ['cloudflared', 'bufferutil', 'utf-8-validate'],
    sourcemap: false,
    minify: false,
    logLevel: 'info',
    resolveExtensions: ['.ts', '.js', '.mjs', '.cjs', '.json'],
    loader: { '.ts': 'ts' },
    plugins: [resolveJsToTs],
    banner: {
      js: '// Taft launcher — bundled by esbuild. See launcher/src/launcher.ts',
    },
  })
  .then(() => {
    const stat = fs.statSync(OUT);
    const kb = (stat.size / 1024).toFixed(0);
    console.log(`  [+] ${path.relative(LAUNCHER_DIR, OUT)}  ${kb} KB`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
