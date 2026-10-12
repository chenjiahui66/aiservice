@echo off
chcp 65001 > nul
REM ============================================================
REM Package deployment artifacts -> nbservice-deploy.tar.gz
REM
REM Usage:   scripts\package-deploy.cmd
REM Requires: Node.js 18+ on PATH (only `node`, no extra deps)
REM
REM Output:   <repo>\nbservice-deploy.tar.gz
REM
REM NOTE: keep this file ASCII-only and CRLF.
REM   CRLF -> cmd.exe parses each line correctly.
REM   Non-ASCII would depend on the console code page.
REM ============================================================

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found on PATH. Install Node.js 18 or newer.
  exit /b 1
)

node "%~dp0package-deploy.mjs"
exit /b %ERRORLEVEL%
