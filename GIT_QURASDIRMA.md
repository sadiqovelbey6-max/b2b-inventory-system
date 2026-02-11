# Git Quraşdırma və CI Commit

## 1. Git Yükləyin

**Link:** https://git-scm.com/download/win

Və ya birbaşa: https://github.com/git-for-windows/git/releases/latest

- `Git-2.x.x-64-bit.exe` faylını endirin
- Quraşdırıcını işə salın
- Default seçimlərlə davam edin (Next, Next)
- **"Add Git to PATH"** seçiminin qeydə alındığından əmin olun

## 2. Terminali Yenidən Açın

Quraşdırmadan sonra **PowerShell və ya Cursor terminalını bağlayıb yenidən açın** – bu lazımdır ki, PATH yenilənsin.

## 3. Commit və Push

Yeni terminalda:

```powershell
cd C:\Users\ASUS\OneDrive\Desktop\serviceb2b\b2b-inventory-system
.\ci-commit-and-push.ps1
```

## 4. GitHub Remote (ilk dəfə üçün)

Əgər layihəni GitHub-a əlavə etmək istəyirsinizsə:

```powershell
# Yeni repo yaratdıqdan sonra (GitHub.com-da)
git remote add origin https://github.com/SIZIN_USERNAME/b2b-inventory-system.git
git branch -M main
git push -u origin main
```

## Script nə edir?

- Dəyişiklikləri stage edir (`git add .`)
- Commit yaradır: "CI: ESLint fix, Vitest threads pool, Cypress E2E updates"
- `origin` remote varsa push edir
