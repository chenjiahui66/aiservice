@echo off
chcp 65001 > nul
REM ============================================================
REM 生成管理员 BCrypt 散列
REM 用项目自身的 BCryptPasswordEncoder，保证与应用校验逻辑一致。
REM
REM 用法： scripts\gen-admin-hash.cmd [密码]
REM
REM 只依赖 spring-security-crypto + spring-core 两个 jar，
REM 避开「全量 Maven classpath 超过 Windows 命令行长度上限」的问题。
REM ============================================================
setlocal

set "PWD=%~1"
if "%PWD%"=="" set "PWD=AdminDev123456"

set "M2=%USERPROFILE%\.m2\repository"
set "SEC=%M2%\org\springframework\security\spring-security-crypto"
set "CORE=%M2%\org\springframework\spring-core"

REM 取该组件下最新的一个版本目录
for /f "delims=" %%d in ('dir /b /ad /o-n "%SEC%" 2^>nul') do set "SECVER=%%d" & goto :found
:found
if "%SECVER%"=="" (
  echo [ERROR] 未找到 spring-security-crypto，请先在 backend 目录执行 mvn dependency:go-offline
  exit /b 1
)
for /f "delims=" %%d in ('dir /b /ad /o-n "%CORE%" 2^>nul') do set "COREVER=%%d" & goto :found2
:found2

REM spring-jcl 提供 org.apache.commons.logging（Spring 6 不再依赖 commons-logging 官方包）
set "JCL=%M2%\org\springframework\spring-jcl"
for /f "delims=" %%d in ('dir /b /ad /o-n "%JCL%" 2^>nul') do set "JCLVER=%%d" & goto :found3
:found3

set "SECJAR=%SEC%\%SECVER%\spring-security-crypto-%SECVER%.jar"
set "COREJAR=%CORE%\%COREVER%\spring-core-%COREVER%.jar"
set "JCLJAR=%JCL%\%JCLVER%\spring-jcl-%JCLVER%.jar"

if not exist "%SECJAR%"  ( echo [ERROR] 缺少 %SECJAR%  & exit /b 1 )
if not exist "%COREJAR%" ( echo [ERROR] 缺少 %COREJAR% & exit /b 1 )
if not exist "%JCLJAR%"  ( echo [ERROR] 缺少 %JCLJAR%  & exit /b 1 )

set "SRC=%TEMP%\GenAdminHash.java"
> "%SRC%" echo import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
>>"%SRC%" echo public class GenAdminHash { public static void main(String[] a) {
>>"%SRC%" echo   var e = new BCryptPasswordEncoder();
>>"%SRC%" echo   var h = e.encode(a[0]);
>>"%SRC%" echo   System.out.println("HASH=" + h);
>>"%SRC%" echo   System.out.println("VERIFY=" + e.matches(a[0], h));
>>"%SRC%" echo } }

java -cp "%SECJAR%;%COREJAR%;%JCLJAR%" "%SRC%" "%PWD%"
set "RC=%ERRORLEVEL%"
del "%SRC%"
exit /b %RC%