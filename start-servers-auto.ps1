# Avtomatik server baslatma scripti

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Server Baslatma Scripti" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Node proseslerini dayandir
Write-Host "[1/5] Node proseslerini dayandirirram..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "  OK" -ForegroundColor Green

# Docker container-larini yoxla ve baslat
Write-Host "[2/5] Docker container-larini yoxlayiram..." -ForegroundColor Yellow
Set-Location $PSScriptRoot
docker-compose up -d postgres redis | Out-Null
Start-Sleep -Seconds 3
Write-Host "  OK - PostgreSQL ve Redis basladildi" -ForegroundColor Green

# Backend server-i yeni PowerShell penceresinde baslat
Write-Host "[3/5] Backend server-i basladirram..." -ForegroundColor Yellow
$backendPath = Join-Path $PSScriptRoot "backend"
$backendScript = @"
`$Host.UI.RawUI.WindowTitle = 'Backend Server - Port 4000'
cd '$backendPath'
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '  Backend Server Basladilir...' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''
npm run start:dev
"@
$backendScriptFile = Join-Path $PSScriptRoot "backend-start.ps1"
$backendScript | Out-File -FilePath $backendScriptFile -Encoding UTF8
Start-Process powershell -ArgumentList "-NoExit", "-File", $backendScriptFile
Start-Sleep -Seconds 3
Write-Host "  OK - Backend server PowerShell penceresinde basladildi" -ForegroundColor Green

# Frontend server-i yeni PowerShell penceresinde baslat
Write-Host "[4/5] Frontend server-i basladirram..." -ForegroundColor Yellow
$frontendPath = Join-Path $PSScriptRoot "frontend"
$frontendScript = @"
`$Host.UI.RawUI.WindowTitle = 'Frontend Server - Port 5173'
cd '$frontendPath'
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '  Frontend Server Basladilir...' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''
npm run dev
"@
$frontendScriptFile = Join-Path $PSScriptRoot "frontend-start.ps1"
$frontendScript | Out-File -FilePath $frontendScriptFile -Encoding UTF8
Start-Process powershell -ArgumentList "-NoExit", "-File", $frontendScriptFile
Start-Sleep -Seconds 3
Write-Host "  OK - Frontend server PowerShell penceresinde basladildi" -ForegroundColor Green

# Status yoxlamasi
Write-Host "[5/5] Server status-unu yoxlayiram..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Serverler Basladildi!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend:  http://localhost:4000/api" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host "PostgreSQL: localhost:5432" -ForegroundColor Yellow
Write-Host "Redis: localhost:6379" -ForegroundColor Yellow
Write-Host ""
Write-Host "Qeyd: Backend server-in baslamasi ucun 20-30 saniye gozleyin." -ForegroundColor Cyan
Write-Host "      Backend PowerShell penceresinde log-lari izleye bilersiniz." -ForegroundColor Cyan
Write-Host ""
Write-Host "Test Login:" -ForegroundColor Green
Write-Host "  Email: admin@demo.az" -ForegroundColor White
Write-Host "  Password: Admin123!" -ForegroundColor White
Write-Host ""
Write-Host "Bu PowerShell penceresini baglaya bilersiniz." -ForegroundColor Gray
Write-Host ""

