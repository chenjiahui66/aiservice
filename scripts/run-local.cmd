@echo off
REM ============================================================
REM 本地开发启动脚本（Windows / PowerShell 或 cmd 均可）
REM 用法： scripts\run-local.cmd  或  scripts\run-local.ps1
REM
REM 敏感项一律从环境变量读取，本文件不含任何真实口令。
REM 首次使用请先创建 deploy\.env（该文件已被 .gitignore 忽略）
REM ============================================================
setlocal

if exist "%~dp0..\deploy\.env" (
  for /f "usebackq tokens=1,* delims==" %%a in ("%~dp0..\deploy\.env") do (
    if not "%%a"=="" if not "%%a"==# (
      set "%%a=%%b"
    )
  )
  echo [env] 已加载 deploy\.env
) else (
  echo [env] 未找到 deploy\.env，将使用当前环境变量与默认值
)

if "%DB_PASSWORD%"=="" set "DB_PASSWORD=NbLocal2026Dev"
if "%ADMIN_PASSWORD%"=="" set "ADMIN_PASSWORD=AdminDev123456"
if "%JWT_PROVIDER_SECRET%"=="" set "JWT_PROVIDER_SECRET=dev-provider-secret-change-me-please-32b"
if "%JWT_ADMIN_SECRET%"=="" set "JWT_ADMIN_SECRET=dev-admin-secret-change-me-please-32bytes"
if "%SPRING_PROFILES_ACTIVE%"=="" set "SPRING_PROFILES_ACTIVE=dev"

echo [start] 启动后端 http://localhost:%SERVER_PORT%
cd /d "%~dp0..\backend"
mvn -q spring-boot:run
endlocal