@echo off
chcp 65001 > nul
REM ============================================================
REM 后端独立启动脚本
REM   启动： scripts\start-backend.cmd
REM   停止： scripts\stop-backend.cmd
REM
REM 优先读取 deploy\.env；未提供则用开发默认值。
REM 生产环境请使用 deploy\docker-compose.yml，不要用本脚本。
REM ============================================================

set "ROOT=%~dp0.."
set "JAR=%ROOT%\backend\target\neighborhood-backend.jar"
set "LOG=%ROOT%\backend\logs\app.log"

if not exist "%JAR%" (
  echo [ERROR] 未找到 jar: %JAR%
  echo 请先执行: cd backend ^&^& mvn -DskipTests package
  exit /b 1
)

if not exist "%ROOT%\backend\logs" mkdir "%ROOT%\backend\logs"

REM 用 PowerShell 读取 .env 并导出为环境变量（batch 自己解析 .env 容易出错）
if exist "%ROOT%\deploy\.env" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Get-Content '%ROOT%\deploy\.env' | Where-Object { $_ -match '^\s*[^#\s][^=]*=' } | ForEach-Object { $p = $_ -split '=', 2; [Environment]::SetEnvironmentVariable($p[0].Trim(), $p[1].Trim(), 'Process') }"
  echo [env] 已加载 deploy\.env
) else (
  echo [env] 未找到 deploy\.env，使用开发默认值
)

if "%DB_PASSWORD%"==""         set "DB_PASSWORD=NbLocal2026Dev"
if "%ADMIN_PASSWORD%"==""      set "ADMIN_PASSWORD=AdminDev123456"
if "%JWT_PROVIDER_SECRET%"=="" set "JWT_PROVIDER_SECRET=dev-provider-secret-change-me-please-32b"
if "%JWT_ADMIN_SECRET%"==""    set "JWT_ADMIN_SECRET=dev-admin-secret-change-me-please-32bytes"
if "%SPRING_PROFILES_ACTIVE%"=="" set "SPRING_PROFILES_ACTIVE=dev"

REM 直接以独立进程启动内部脚本，避免 start 里嵌套 cmd /c 的转义地狱
start "neighborhood-backend" /min "%~dp0run-backend-jar.cmd"

echo [start] 已启动，日志: %LOG%
echo [done] 约 5~10 秒后访问 http://localhost:8080/doc.html
endlocal