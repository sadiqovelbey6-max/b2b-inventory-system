Write-Host "`n========================================" -ForegroundColor Green
Write-Host "=== SERVERLER YENIDEN BASLATILIR ===" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Node prosesləri dayandırılır
Write-Host "=== Node Prosesləri Dayandırılır ===" -ForegroundColor Cyan
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "Node prosesləri dayandırıldı" -ForegroundColor Yellow

# Docker Desktop yoxlanılır
Write-Host "`n=== Docker Desktop Yoxlanilir ===" -ForegroundColor Cyan
try {
    docker ps 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Docker Desktop işləyir!" -ForegroundColor Green
    } else {
        throw "Docker işləmir"
    }
} catch {
    Write-Host "Docker Desktop işləmir, açılır..." -ForegroundColor Yellow
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue
    Write-Host "Docker Desktop açılır... Gözləyirəm ki, tam yüklənsin..." -ForegroundColor Yellow
    $maxAttempts = 60
    $attempt = 0
    while ($attempt -lt $maxAttempts) {
        Start-Sleep -Seconds 2
        try {
            docker ps 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Docker Desktop hazırdır!" -ForegroundColor Green
                break
            }
        } catch {}
        $attempt++
        if ($attempt % 5 -eq 0) {
            Write-Host "Gözləyirəm... ($attempt/$maxAttempts)" -ForegroundColor Yellow
        }
    }
}

# Docker konteynerləri başladılır
Write-Host "`n=== Docker Konteynerləri Başladılır ===" -ForegroundColor Cyan
Set-Location "C:\Users\ASUS\OneDrive\Desktop\serviceb2b\b2b-inventory-system"
docker-compose down 2>&1 | Out-Null
Start-Sleep -Seconds 2
docker-compose up -d 2>&1
Start-Sleep -Seconds 5

Write-Host "`n=== Docker Status ===" -ForegroundColor Cyan
docker ps --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}" 2>&1

# Backend server başladılır
Write-Host "`n=== Backend Server Baslatilir ===" -ForegroundColor Cyan
Write-Host "Backend URL: http://localhost:4000" -ForegroundColor Yellow
Set-Location "C:\Users\ASUS\OneDrive\Desktop\serviceb2b\b2b-inventory-system\backend"
$backendScript = "Write-Host '=== BACKEND SERVER ===' -ForegroundColor Green; Write-Host 'Backend: http://localhost:4000' -ForegroundColor Yellow; Write-Host ''; npm run start:dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript

# Frontend server başladılır
Start-Sleep -Seconds 3
Write-Host "`n=== Frontend Server Baslatilir ===" -ForegroundColor Cyan
Write-Host "Frontend URL: http://localhost:5173" -ForegroundColor Yellow
Set-Location "C:\Users\ASUS\OneDrive\Desktop\serviceb2b\b2b-inventory-system\frontend"
$frontendScript = "Write-Host '=== FRONTEND SERVER ===' -ForegroundColor Green; Write-Host 'Frontend: http://localhost:5173' -ForegroundColor Yellow; Write-Host ''; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendScript

# Status göstərilir
Start-Sleep -Seconds 10
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "=== SERVERLER VE DOCKER STATUS ===" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`n1. Backend Server: http://localhost:4000" -ForegroundColor Yellow
Write-Host "2. Frontend Server: http://localhost:5173" -ForegroundColor Yellow
Write-Host "`n=== Docker Konteynerləri ===" -ForegroundColor Cyan
docker ps --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}" 2>&1
Write-Host "`n=== Node Prosesləri ===" -ForegroundColor Cyan
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Select-Object Id, ProcessName, StartTime | Format-Table -AutoSize
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Serverlər və Docker hazırdır!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`nTerminal hazırdır. Komanda gözləyir..." -ForegroundColor Cyan
Write-Host "`nPS $(Get-Location)> " -NoNewline -ForegroundColor Yellow
