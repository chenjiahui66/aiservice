@echo off
chcp 65001 > nul
REM 停止本地后端进程，逻辑见 stop-backend.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-backend.ps1"
endlocal