@echo off
title Gmail Scheduler
color 0A

echo ============================================
echo   Gmail Scheduler - Menjalankan Server...
echo ============================================
echo.

cd /d "%~dp0"

REM Cek apakah node_modules sudah ada
if not exist "node_modules\" (
  echo [SETUP] Menginstal dependensi... harap tunggu...
  npm install
  echo.
)

REM Cek apakah frontend sudah di-build
if not exist "dashboard\frontend\dist\index.html" (
  echo [SETUP] Menyiapkan tampilan dashboard... harap tunggu...
  cd dashboard\frontend
  if not exist "node_modules\" npm install
  npm run build
  cd ..\..
  echo.
)

echo [OK] Server berjalan di http://localhost:5000
echo.
echo Buka browser dan akses: http://localhost:5000
echo.
echo Tekan Ctrl+C untuk mematikan server.
echo.

node server.js
pause
