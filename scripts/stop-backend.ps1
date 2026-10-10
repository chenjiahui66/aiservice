<#
  停止本地后端进程。
  精确匹配命令行中含 neighborhood-backend.jar 的 java 进程，
  避免误杀占用 8080 的其它程序。
#>
$ErrorActionPreference = 'Stop'
# .cmd 里已 chcp 65001，PowerShell 需同步设为 UTF-8，否则中文输出乱码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$procs = Get-CimInstance Win32_Process -Filter "Name='java.exe'" |
    Where-Object { $_.CommandLine -like '*neighborhood-backend.jar*' }

if (-not $procs) {
    Write-Host '[stop] 未找到运行中的 neighborhood-backend.jar 进程'
    exit 0
}

foreach ($p in $procs) {
    Write-Host ("[stop] 停止 PID {0}" -f $p.ProcessId)
    Stop-Process -Id $p.ProcessId -Force
}

Write-Host '[stop] 完成'