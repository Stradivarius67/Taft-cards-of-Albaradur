@echo off
echo === Тафт: Карты Альбарадура — первый запуск ===
echo.

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Node.js не найден. Установите: https://nodejs.org
    exit /b 1
)

echo Node.js найден — OK
echo.

echo Устанавливаю зависимости...
call npm ci
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%

echo Собираю production-версию...
call npm run build
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%

echo.
echo === Готово! ===
echo.
echo Запуск для разработки: npm run dev
echo Запуск для игры:       npm start
echo Для онлайн-игры:       npm run host
