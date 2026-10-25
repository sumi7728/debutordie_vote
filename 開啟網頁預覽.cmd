@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "VOTE_NODE=C:\Program Files\nodejs\node.exe"
if not exist "%VOTE_NODE%" set "VOTE_NODE=node"
"%VOTE_NODE%" preview.cjs --open
if errorlevel 1 pause
