$Host.UI.RawUI.WindowTitle = 'Backend Server - Port 4000'
cd 'C:\Users\ASUS\OneDrive\Desktop\serviceb2b\b2b-inventory-system\backend'
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '  Backend Server Basladilir...' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''
npm run start:dev
