# Backend və Frontend serverləri başlatmaq üçün script

Write-Host "🚀 Serverləri başladırıram..." -ForegroundColor Green

# Backend server-i yeni PowerShell pəncərəsində başlat
$backendScript = @"
cd '$PSScriptRoot\backend'
Write-Host 'Backend server başladılır...' -ForegroundColor Cyan
npm run start:dev
"@

$backendScript | Out-File -FilePath "$PSScriptRoot\backend-start.ps1" -Encoding UTF8
Start-Process powershell -ArgumentList "-NoExit", "-File", "$PSScriptRoot\backend-start.ps1"

Start-Sleep -Seconds 3

# Frontend server-i yeni PowerShell pəncərəsində başlat
$frontendScript = @"
cd '$PSScriptRoot\frontend'
Write-Host 'Frontend server başladılır...' -ForegroundColor Cyan
npm run dev
"@

$frontendScript | Out-File -FilePath "$PSScriptRoot\frontend-start.ps1" -Encoding UTF8
Start-Process powershell -ArgumentList "-NoExit", "-File", "$PSScriptRoot\frontend-start.ps1"

Write-Host "✅ Serverlər başladıldı!" -ForegroundColor Green
Write-Host "Backend: http://localhost:4000" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Yellow

