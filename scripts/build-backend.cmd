@echo off
REM ============================================================
REM 邻里服务管家 —— 后端 jar 一键打包
REM
REM 用法（双击即可，或在 cmd 里执行）：
REM     scripts\build-backend.cmd
REM
REM 产出：
REM     backend\target\neighborhood-backend.jar
REM
REM 为什么要用这个脚本而不是直接 mvn package：
REM   1. 必须带 clean。上次 jar 就是被「没 clean 的增量编译 + 旧 class
REM      残留」坑到的，编译产物比 jar 还新，代码改了但 jar 没变。
REM   2. 必须锁 UTF-8。本机 platform encoding 是 GBK，不锁会在
REM      中文资源/源码上产生乱码，容器里 -Dfile.encoding=UTF-8 也救不回来。
REM   3. 打完之后自动跑编码回归检查，配置写错当场报，不留到线上。
REM ============================================================
setlocal
setlocal EnableDelayedExpansion

cd /d "%~dp0.."

echo ============================================
echo  1/3 清理并重新打包（clean package）
echo ============================================
set JAVA_TOOL_OPTIONS=-Dfile.encoding=UTF-8
cd backend
mvn -DskipTests clean package
if errorlevel 1 (
  echo.
  echo [FAIL] Maven 构建失败，请看上面的错误输出
  exit /b 1
)
cd ..

echo.
echo ============================================
echo  2/3 编码回归检查
echo ============================================
node tests\check-encoding.cjs
if errorlevel 1 (
  echo.
  echo [FAIL] 编码检查未通过，jar 不要上传
  exit /b 1
)

echo.
echo ============================================
echo  3/3 产物信息
echo ============================================
if not exist "backend\target\neighborhood-backend.jar" (
  echo [FAIL] 没有产出 jar
  exit /b 1
)

for %%F in ("backend\target\neighborhood-backend.jar") do (
  echo   路径: %%~fF
  echo   大小: %%~zF bytes
)

REM MD5 用来核对服务器上的文件和本地是否一致
certutil -hashfile "backend\target\neighborhood-backend.jar" MD5 | findstr /r "^[0-9a-fA-F ]*$"

echo.
echo [PASS] 打包完成
echo 上传命令（Windows -&gt; 服务器）：
echo   scp backend\target\neighborhood-backend.jar root@47.98.253.138:/opt/nbservice/backend/target/
endlocal
