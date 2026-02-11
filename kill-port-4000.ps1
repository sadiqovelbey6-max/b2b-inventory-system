# Port 4000-dəki prosesi tap və dayandır

Write-Host "Port 4000-dəki prosesi yoxlayır..." -ForegroundColor Yellow

$process = Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($process) {
    Write-Host "Port 4000-də proses tapıldı: PID $process" -ForegroundColor Yellow
    try {
        Stop-Process -Id $process -Force -ErrorAction Stop
        Write-Host "✅ Proses dayandırıldı (PID: $process)" -ForegroundColor Green
        Start-Sleep -Seconds 2
    } catch {
        Write-Host "❌ Proses dayandırıla bilmədi: $_" -ForegroundColor Red
    }
} else {
    Write-Host "Port 4000 boşdur" -ForegroundColor Green
}

# Node proseslərini də yoxla
Write-Host "`nNode proseslərini yoxlayır..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "Node prosesləri tapıldı, dayandırılır..." -ForegroundColor Yellow
    foreach ($proc in $nodeProcesses) {
        try {
            Stop-Process -Id $proc.Id -Force -ErrorAction Stop
            Write-Host "  ✅ Dayandırıldı (PID: $($proc.Id))" -ForegroundColor Gray
        } catch {
            # Ignore
        }
    }
    Start-Sleep -Seconds 2
} else {
    Write-Host "Node prosesləri tapılmadı" -ForegroundColor Green
}

Write-Host "`n✅ Port 4000 hazırdır!" -ForegroundColor Green
