# Docker Desktop Problemini Həll Etmə Scripti
# Bu script-i Administrator hüquqları ilə icra edin

Write-Host "`n=== Docker Desktop Problemini Həll Etmə ===" -ForegroundColor Cyan

# Administrator hüquqlarını yoxla
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "❌ XƏTA: Bu script Administrator hüquqları ilə icra edilməlidir!" -ForegroundColor Red
    Write-Host "PowerShell-i sağ kliklə açıb 'Run as Administrator' seçin." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Administrator hüquqları təsdiqləndi`n" -ForegroundColor Green

# 1. Virtualization status yoxlanılır
Write-Host "=== 1. Virtualization Status ===" -ForegroundColor Cyan
$vmEnabled = (Get-WmiObject -Class Win32_Processor).VirtualizationFirmwareEnabled
if ($vmEnabled) {
    Write-Host "✅ Virtualization aktivdir" -ForegroundColor Green
} else {
    Write-Host "❌ Virtualization deaktivdir!" -ForegroundColor Red
    Write-Host "`n⚠️ MÜHİM: Virtualization-i BIOS/UEFI-də aktiv etmək lazımdır!" -ForegroundColor Yellow
    Write-Host "`nAddımlar:" -ForegroundColor Cyan
    Write-Host "1. Komputeri yenidən başlatın" -ForegroundColor White
    Write-Host "2. BIOS/UEFI-ə daxil olun (F2, F10, F12, Delete düyməsi - kompüterdən asılıdır)" -ForegroundColor White
    Write-Host "3. 'Virtualization Technology' və ya 'Intel VT-x' / 'AMD-V' seçimini tapın" -ForegroundColor White
    Write-Host "4. Aktiv edin və saxlamaq üçün F10 basın" -ForegroundColor White
    Write-Host "5. Komputeri yenidən başlatın" -ForegroundColor White
    Write-Host "`n⚠️ Virtualization aktiv olmadan Docker Desktop işləməyəcək!" -ForegroundColor Red
    Write-Host "`nDavam etmək istəyirsiniz? (Y/N): " -ForegroundColor Yellow -NoNewline
    $response = Read-Host
    if ($response -ne "Y" -and $response -ne "y") {
        Write-Host "Script dayandırıldı." -ForegroundColor Yellow
        exit 1
    }
}

# 2. WSL2 yoxlanılır
Write-Host "`n=== 2. WSL2 Status ===" -ForegroundColor Cyan
$wslStatus = wsl --status 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ WSL2 quraşdırılıb" -ForegroundColor Green
    Write-Host $wslStatus -ForegroundColor Gray
} else {
    Write-Host "⚠️ WSL2 quraşdırılmayıb və ya problem var" -ForegroundColor Yellow
    Write-Host "WSL2 quraşdırılır..." -ForegroundColor Yellow
    dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
    dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
    Write-Host "✅ WSL2 komponentləri aktiv edildi. Komputeri yenidən başlatmaq lazımdır." -ForegroundColor Green
}

# 3. Hyper-V yoxlanılır və aktiv edilir
Write-Host "`n=== 3. Hyper-V Status ===" -ForegroundColor Cyan
try {
    $hyperV = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -ErrorAction Stop
    if ($hyperV.State -eq 'Enabled') {
        Write-Host "✅ Hyper-V aktivdir" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Hyper-V deaktivdir. Aktiv edilir..." -ForegroundColor Yellow
        Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -NoRestart
        Write-Host "✅ Hyper-V aktiv edildi. Komputeri yenidən başlatmaq lazımdır." -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️ Hyper-V yoxlanıla bilmədi: $_" -ForegroundColor Yellow
}

# 4. Docker Desktop Service başladılır
Write-Host "`n=== 4. Docker Desktop Service ===" -ForegroundColor Cyan
$dockerService = Get-Service -Name "com.docker.service" -ErrorAction SilentlyContinue
if ($dockerService) {
    if ($dockerService.Status -eq 'Running') {
        Write-Host "✅ Docker Desktop Service artıq işləyir" -ForegroundColor Green
    } else {
        Write-Host "Docker Desktop Service başladılır..." -ForegroundColor Yellow
        try {
            Start-Service -Name "com.docker.service" -ErrorAction Stop
            Write-Host "✅ Docker Desktop Service başladıldı" -ForegroundColor Green
        } catch {
            Write-Host "❌ Docker Desktop Service başladıla bilmədi: $_" -ForegroundColor Red
            Write-Host "Səbəb: Service manual başlatma tələb edir və ya virtualization deaktivdir." -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "⚠️ Docker Desktop Service tapılmadı" -ForegroundColor Yellow
}

# 5. Docker Desktop prosesləri yoxlanılır
Write-Host "`n=== 5. Docker Desktop Prosesləri ===" -ForegroundColor Cyan
$dockerProcesses = Get-Process | Where-Object { $_.ProcessName -like "*Docker*" -or $_.ProcessName -like "*com.docker*" }
if ($dockerProcesses) {
    Write-Host "✅ Docker Desktop prosesləri işləyir:" -ForegroundColor Green
    $dockerProcesses | Select-Object ProcessName, Id | Format-Table -AutoSize
} else {
    Write-Host "⚠️ Docker Desktop prosesləri tapılmadı" -ForegroundColor Yellow
    Write-Host "Docker Desktop-ı manual başlatmaq lazımdır." -ForegroundColor Yellow
}

# 6. Docker CLI test
Write-Host "`n=== 6. Docker CLI Test ===" -ForegroundColor Cyan
docker --version 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Docker CLI işləyir" -ForegroundColor Green
    docker --version
    
    Write-Host "`nDocker info test edilir..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    docker info 2>&1 | Select-Object -First 10
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Docker Desktop tam işləyir!" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️ Docker Desktop hələ tam hazır deyil" -ForegroundColor Yellow
        Write-Host "Bir az gözləyin və ya Docker Desktop pəncərəsini açıb status-u yoxlayın." -ForegroundColor Cyan
    }
} else {
    Write-Host "❌ Docker CLI işləmir" -ForegroundColor Red
}

# 7. Yekun tövsiyələr
Write-Host "`n=== Yekun Tövsiyələr ===" -ForegroundColor Cyan
Write-Host "`n1. Əgər virtualization deaktivdirsə:" -ForegroundColor Yellow
Write-Host "   - BIOS/UEFI-də aktiv edin və komputeri yenidən başlatın" -ForegroundColor White
Write-Host "`n2. Əgər WSL2 və ya Hyper-V aktiv edildisə:" -ForegroundColor Yellow
Write-Host "   - Komputeri yenidən başlatın" -ForegroundColor White
Write-Host "`n3. Docker Desktop-ı başlatın:" -ForegroundColor Yellow
Write-Host "   - Start menu-dan 'Docker Desktop' axtarın və açın" -ForegroundColor White
Write-Host "   - Və ya: Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'" -ForegroundColor White
Write-Host "`n4. Docker Desktop tam yüklənəndən sonra test edin:" -ForegroundColor Yellow
Write-Host "   docker info" -ForegroundColor White
Write-Host "   docker ps" -ForegroundColor White
