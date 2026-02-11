# Docker Desktop Quraşdırma Təlimatları

## Addım 1: Docker Desktop yükləyin
1. https://www.docker.com/products/docker-desktop/ -dan Docker Desktop yükləyin
2. Installer-i işə salın və quraşdırın
3. Quraşdırmadan sonra kompüteri yenidən başlatın (vacibdir!)

## Addım 2: Docker Desktop-u başlatın
1. Start Menu-dan Docker Desktop-u açın
2. Docker Desktop-un tam yüklənməsini gözləyin (tray icon-da)
3. YENİ PowerShell terminali açın (PATH yenilənməsi üçün)

## Addım 3: Sistem aktivləşdirin
Yeni PowerShell terminalində:
```powershell
cd C:\Users\ASUS\OneDrive\Desktop\serviceb2b\b2b-inventory-system
docker compose up -d postgres redis
```

## Addım 4: Status yoxlayın
```powershell
docker ps
```

## Sistem URL-ləri
- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- API Docs: http://localhost:4000/api/docs
- Health Check: http://localhost:4000/api/health

## Test məlumatları
- Email: admin@demo.az
- Password: Admin123!

