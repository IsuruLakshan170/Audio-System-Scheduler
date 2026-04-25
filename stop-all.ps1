# Stops dev servers for Audio Scheduler (Flask on 5000, React on 3000).
$ErrorActionPreference = 'SilentlyContinue'

function Stop-ListenersOnPort([int] $Port) {
    $conns = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    if ($conns.Count -eq 0) {
        Write-Host "Port $Port : nothing listening"
        return
    }
    foreach ($c in $conns) {
        $procId = $c.OwningProcess
        Write-Host "Port $Port : stopping process $procId"
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Stopping Audio Scheduler (ports 5000, 3000)..." -ForegroundColor Yellow
Stop-ListenersOnPort 5000
Stop-ListenersOnPort 3000
Write-Host "Done. Close this window and any leftover terminals if needed." -ForegroundColor Green
