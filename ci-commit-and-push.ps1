# CI dəyişikliklərin commit və push etməsi
# Git quraşdırıldıqdan sonra işə salın: .\ci-commit-and-push.ps1

$ErrorActionPreference = "Stop"
$repoPath = $PSScriptRoot

# Git yoxla
$gitPaths = @(
    "C:\Program Files\Git\bin\git.exe",
    "C:\Program Files (x86)\Git\bin\git.exe",
    "git"
)
$git = $null
foreach ($p in $gitPaths) {
    if ($p -eq "git") {
        try { $git = (Get-Command git -ErrorAction Stop).Source; break } catch {}
    } elseif (Test-Path $p) {
        $git = $p
        break
    }
}

if (-not $git) {
    Write-Host "XETA: Git tapilmadi. Git qurasdirin: https://git-scm.com/download/win" -ForegroundColor Red
    exit 1
}

Set-Location $repoPath

# Repo yoxla
$hasGit = Test-Path ".git"
if (-not $hasGit) {
    Write-Host "Git repo initialized edilir..." -ForegroundColor Yellow
    & $git init
}

& $git add .
$status = & $git status --short
if (-not $status) {
    Write-Host "Deyisiklik yoxdur." -ForegroundColor Yellow
    exit 0
}

Write-Host "Staged fayllar:" -ForegroundColor Cyan
& $git status --short

& $git commit -m "CI: ESLint fix, Vitest threads pool, Cypress E2E updates"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit xetasi." -ForegroundColor Red
    exit 1
}

# Remote yoxla
$remote = & $git remote get-url origin 2>$null
if ($remote) {
    Write-Host "Push edilir..." -ForegroundColor Cyan
    & $git push
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Ugurla push edildi!" -ForegroundColor Green
    } else {
        Write-Host "Push xetasi (remote/branch yoxlamaq olar)." -ForegroundColor Yellow
    }
} else {
    Write-Host "Remote 'origin' tapilmadi. Commit yerel edildi." -ForegroundColor Yellow
    Write-Host "GitHub-a qoshmaq ucun: git remote add origin <url>" -ForegroundColor Yellow
}
