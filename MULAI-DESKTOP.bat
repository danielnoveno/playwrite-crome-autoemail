@echo off
title Gmail Scheduler Desktop
color 0B
chcp 65001 >nul 2>&1

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║       📧  Gmail Scheduler — Desktop App          ║
echo  ╚══════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

REM ---- 1. Check Node.js ----
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  [ERROR] Node.js belum terinstall!
    echo.
    echo  Download di: https://nodejs.org/
    echo  Pilih versi LTS, install, lalu jalankan file ini lagi.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo  [OK] Node.js %%v

REM ---- 2. Install root dependencies ----
if not exist "node_modules\" (
    echo  [SETUP] Menginstal dependensi utama...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo  [ERROR] Gagal install dependensi. Periksa koneksi internet.
        pause
        exit /b 1
    )
    echo.
)

REM ---- 3. Install Electron (devDependency) ----
if not exist "node_modules\electron\" (
    echo  [SETUP] Menginstal Electron untuk desktop app...
    call npm install electron --save-dev
    if %ERRORLEVEL% neq 0 (
        echo  [ERROR] Gagal install Electron. Periksa koneksi internet.
        pause
        exit /b 1
    )
    echo.
)

REM ---- 4. Build dashboard frontend ----
if not exist "dashboard\frontend\dist\index.html" (
    echo  [SETUP] Menyiapkan tampilan dashboard...
    cd dashboard\frontend
    if not exist "node_modules\" call npm install
    call npm run build
    cd ..\..
    if not exist "dashboard\frontend\dist\index.html" (
        echo  [WARNING] Frontend build gagal, dashboard mungkin tidak tampil.
    )
    echo.
)

REM ---- 5. Check Chrome ----
set "CHROME_FOUND=0"
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_FOUND=1"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME_FOUND=1"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_FOUND=1"

if "%CHROME_FOUND%"=="0" (
    echo  [WARNING] Google Chrome tidak ditemukan!
    echo  Chrome diperlukan untuk otomasi Gmail.
    echo  Download di: https://www.google.com/chrome/
    echo.
)

echo.
echo  ───────────────────────────────────────────────
echo   Menjalankan Gmail Scheduler Desktop...
echo   Tutup window ini = aplikasi berhenti.
echo  ───────────────────────────────────────────────
echo.

REM ---- 6. Launch Electron ----
npx electron desktop/main.js

if %ERRORLEVEL% neq 0 (
    echo.
    echo  [ERROR] Aplikasi desktop gagal jalan.
    echo  Coba jalankan secara manual:
    echo    npx electron desktop/main.js
    echo.
)

pause
