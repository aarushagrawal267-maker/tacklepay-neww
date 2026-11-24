@echo off
rem Double-click to run TacketPay on this PC at http://localhost:3000
rem Keep this window open while you use the app; close it (or press Ctrl+C) to stop the server.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get it from https://nodejs.org ^(version 22.13 or newer^), then run this again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing packages ^(first run only, takes about a minute^)...
  call npm install
  if errorlevel 1 (
    echo Installing packages failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

rem Open the browser a few seconds after the server starts.
start "" cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:3000"

echo Starting TacketPay at http://localhost:3000 ...
call npm run dev
pause
