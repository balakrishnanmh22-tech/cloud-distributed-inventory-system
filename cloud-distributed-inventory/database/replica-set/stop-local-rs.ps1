# Stop Native 3-Member MongoDB Replica Set
$BaseDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$PidFile = Join-Path $BaseDir "replica_pids.txt"

if (Test-Path $PidFile) {
    $pids = Get-Content $PidFile
    foreach ($p in $pids) {
        if ($p -match '^\d+$') {
            Stop-Process -Id ([int]$p) -Force -ErrorAction SilentlyContinue
            Write-Host "Stopped MongoDB process PID $p" -ForegroundColor Yellow
        }
    }
    Remove-Item $PidFile -Force
} else {
    # Fallback stop by port inspection
    Get-Process -Name mongod -ErrorAction SilentlyContinue | Where-Object { $_.Path -notlike '*service*' } | Stop-Process -Force -ErrorAction SilentlyContinue
}

Write-Host "Local MongoDB Replica Set stopped cleanly." -ForegroundColor Green
