#!/bin/bash
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

# Установка зависимостей
echo "Устанавливаю зависимости..."
npm install
npm run install:all

echo ""
echo "=== Готово! ==="
echo ""
echo "Запуск для разработки (2 процесса, hot reload):"
echo "  npm run dev"
echo ""
echo "Запуск для игры (один сервер, одна ссылка):"
echo "  npm start"
echo ""
echo "Для онлайн-игры — одна команда поднимает всё:"
echo "  npm run host"
