@echo off
chcp 65001 > nul
REM 停止 scripts\start-backend.cmd 启动的后端进程
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p = Get-CimInstance Win32_Process -Filter ""Name='java.exe'"" ^| Where-Object { $_.CommandLine -like '*neighborhood-backend.jar*' }; if ($p) { $p ^| ForEach-Object { Write-Host ('[stop] PID ' + $_.ProcessId); Stop-Process -Id $_.ProcessId -Force } } else { Write-Host '[stop] 未找到运行中的后端进程' }"
endlocal