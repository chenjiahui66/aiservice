@echo off
REM 内部脚本：由 start-backend.cmd 以独立进程调用，不要直接执行
cd /d "%~dp0..\backend"
if not exist logs mkdir logs
java -Dfile.encoding=UTF-8 -jar target\neighborhood-backend.jar >> logs\app.log 2>&1