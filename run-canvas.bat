@echo off
title Gomgom Canvas (close this window to stop)
cd /d "%~dp0"
set NODE_OPTIONS=--no-experimental-webstorage
start "" cmd /c "timeout /t 8 >nul & start http://localhost:3000"
npm run dev
