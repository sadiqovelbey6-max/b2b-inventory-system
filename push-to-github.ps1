# GitHub-a push
# Istifade: .\push-to-github.ps1 -RepoUrl "https://github.com/USERNAME/b2b-inventory-system.git"

param(
    [Parameter(Mandatory=$false)]
    [string]$RepoUrl
)

$git = "C:\Program Files\Git\bin\git.exe"
$repoPath = $PSScriptRoot

if (-not $RepoUrl) {
    Write-Host "GitHub-da yeni repo yaradin: https://github.com/new" -ForegroundColor Cyan
    Write-Host "Repo adi: b2b-inventory-system (ve ya basqa)" -ForegroundColor Cyan
    Write-Host "README, .gitignore ELave ETMEYIN - movcud fayllar var." -ForegroundColor Yellow
    Write-Host ""
    $RepoUrl = Read-Host "Repo URL daxil edin (məs: https://github.com/username/b2b-inventory-system.git)"
}

if (-not $RepoUrl) {
    Write-Host "XETA: URL lazimdir." -ForegroundColor Red
    exit 1
}

Set-Location $repoPath

# Remote var?
$origin = & $git remote get-url origin 2>$null
if ($origin) {
    Write-Host "Mevcud origin: $origin" -ForegroundColor Yellow
    $change = Read-Host "Deyismek isteyirsiniz? (y/N)"
    if ($change -eq 'y' -or $change -eq 'Y') {
        & $git remote remove origin
    } else {
        Write-Host "Push edilir..." -ForegroundColor Cyan
        & $git branch -M main
        & $git push -u origin main
        exit $LASTEXITCODE
    }
}

& $git remote add origin $RepoUrl
& $git branch -M main
Write-Host "Push edilir..." -ForegroundColor Cyan
& $git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "Ugurla push edildi!" -ForegroundColor Green
} else {
    Write-Host "Push xetasi. GitHub-da repo yaradildigini ve URL-in dogru oldugunu yoxlayin." -ForegroundColor Red
}
