#!/bin/bash
set -euo pipefail

echo "=== Тафт: Карты Альбарадура — первый запуск ==="
echo ""

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js не найден. Установите: https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Требуется Node.js 18+. Текущая версия: $(node -v)"
    exit 1
fi

echo "Node.js $(node -v) — OK"
echo ""

# Установка зависимостей строго по lock-файлу
echo "Устанавливаю зависимости..."
npm ci

echo "Собираю production-версию..."
npm run build

echo ""
echo "=== Готово! ==="
echo ""
echo "Запуск для разработки (2 процесса, hot reload):"
echo "  npm run dev"
echo ""
echo "Запуск для игры (готовая сборка, один сервер):"
echo "  npm start"
echo ""
echo "Для онлайн-игры — одна команда поднимает всё:"
echo "  npm run host"
