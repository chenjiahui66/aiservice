@echo off
chcp 65001 > nul
REM ============================================================
REM 本地开发启动脚本（前台 Maven 运行，改代码后需手动重启）
REM
REM ⚠️ 同样不内置任何密钥，必须先有 deploy\.env
REM 生产环境请使用 deploy\docker-compose.yml，不要用本脚本。
REM ============================================================

set "ROOT=%~dp0.."
set "ENVFILE=%ROOT%\deploy\.env"

if not exist "%ENVFILE%" (
  echo [ERROR] 未找到 %ENVFILE%
  echo 请先执行: copy deploy\.env.example deploy\.env  并填入真实值
  exit /b 1
)

for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%ENVFILE%") do set "%%a=%%b"

if "%SPRING_PROFILES_ACTIVE%"=="" set "SPRING_PROFILES_ACTIVE=dev"

echo [env] 已加载 deploy\.env
echo [start] 前台启动 http://localhost:%SERVER_PORT%
cd /d "%ROOT%\backend"
mvn -q spring-boot:run
endlocal