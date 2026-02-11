# Butun serverleri baslatmaq ucun script

Write-Host "Serverleri basladirram..." -ForegroundColor Green

# Docker container-larini baslat
Write-Host "Docker container-larini yoxlayiram..." -ForegroundColor Cyan
Set-Location $PSScriptRoot
docker-compose up -d postgres redis

Start-Sleep -Seconds 3

# Backend server-i yeni PowerShell penceresinde baslat
$backendPath = Join-Path $PSScriptRoot "backend"
$backendScript = "cd '$backendPath'; Write-Host 'Backend server basladilir...' -ForegroundColor Cyan; npm run start:dev"
$backendScriptFile = Join-Path $PSScriptRoot "backend-start.ps1"
$backendScript | Out-File -FilePath $backendScriptFile -Encoding UTF8
Start-Process powershell -ArgumentList "-NoExit", "-File", $backendScriptFile

Start-Sleep -Seconds 3

# Frontend server-i yeni PowerShell penceresinde baslat
$frontendPath = Join-Path $PSScriptRoot "frontend"
$frontendScript = "cd '$frontendPath'; Write-Host 'Frontend server basladilir...' -ForegroundColor Cyan; npm run dev"
$frontendScriptFile = Join-Path $PSScriptRoot "frontend-start.ps1"
$frontendScript | Out-File -FilePath $frontendScriptFile -Encoding UTF8
Start-Process powershell -ArgumentList "-NoExit", "-File", $frontendScriptFile

Write-Host ""
Write-Host "Serverler basladildi!" -ForegroundColor Green
Write-Host "Backend: http://localhost:4000" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host "Docker PostgreSQL: localhost:5432" -ForegroundColor Yellow
Write-Host "Docker Redis: localhost:6379" -ForegroundColor Yellow
