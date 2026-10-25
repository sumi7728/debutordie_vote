@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to start the local preview.
  pause
  exit /b 1
)
node preview.cjs --open
pause
