@echo off
chcp 65001 > nul
REM ============================================================
REM 后端独立启动脚本
REM   启动： scripts\start-backend.cmd
REM   停止： scripts\stop-backend.cmd
REM
REM ⚠️ 本脚本**不包含任何密钥兜底值**。
REM    所有凭据必须来自 deploy\.env（已被 .gitignore 忽略）。
REM    原因是：若在此硬编码 JWT 密钥兜底，会让 application-prod.yml 的
REM    `${JWT_PROVIDER_SECRET:?}` 启动失败校验失效，导致生产环境
REM    悄悄用上公开可查的签名密钥。
REM ============================================================

set "ROOT=%~dp0.."
set "JAR=%ROOT%\backend\target\neighborhood-backend.jar"
set "LOGDIR=%ROOT%\backend\logs"
set "ENVFILE=%ROOT%\deploy\.env"

if not exist "%JAR%" (
  echo [ERROR] 未找到 jar: %JAR%
  echo 请先执行: cd backend ^&^& mvn -DskipTests package
  exit /b 1
)

if not exist "%ENVFILE%" (
  echo [ERROR] 未找到 %ENVFILE%
  echo.
  echo 请先创建（该文件已被 .gitignore 忽略，不会进入仓库）：
  echo     copy deploy\.env.example deploy\.env
  echo 然后填入 DB_PASSWORD / ADMIN_PASSWORD / 两个 JWT 密钥。
  echo.
  echo 生成 JWT 密钥可用： openssl rand -base64 48
  exit /b 1
)

if not exist "%LOGDIR%" mkdir "%LOGDIR%"

REM 从 .env 载入变量到当前 cmd 进程
REM （必须由 cmd 自己 set：PowerShell 的 SetEnvironmentVariable(...,'Process')
REM   只影响那个 PowerShell 进程，退出后即失效，后续校验读不到）
for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%ENVFILE%") do set "%%a=%%b"

REM 校验关键项确实有值，避免带着空值启动
if "%DB_PASSWORD%"=="" (
  echo [ERROR] DB_PASSWORD 未在 deploy\.env 中配置或为空，已中止启动
  exit /b 1
)
if "%JWT_PROVIDER_SECRET%"=="" (
  echo [ERROR] JWT_PROVIDER_SECRET 未配置，已中止启动
  exit /b 1
)
if "%JWT_ADMIN_SECRET%"=="" (
  echo [ERROR] JWT_ADMIN_SECRET 未配置，已中止启动
  exit /b 1
)

if "%SPRING_PROFILES_ACTIVE%"=="" set "SPRING_PROFILES_ACTIVE=dev"

REM 直接以独立进程启动内部脚本，避免 start 内嵌 cmd /c 的转义地狱
start "neighborhood-backend" /min "%~dp0run-backend-jar.cmd"

echo [start] 已启动，日志: %LOGDIR%\app.log
echo [done] 约 5~10 秒后访问 http://localhost:8080/doc.html
endlocal