<#
  elevate-package.ps1
  Launches itself elevated (UAC prompt) if not already admin, then runs packaging (npm run dist).
  Usage from VS Code integrated terminal:
    powershell -ExecutionPolicy Bypass -File .\scripts\elevate-package.ps1
#>

function Test-IsAdmin {
  $current = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($current)
  return $principal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
}

if (-not (Test-IsAdmin)) {
  Write-Host 'Re-launching elevated (UAC prompt)...'
  $scriptPath = $PSCommandPath
  Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList "-NoLogo","-NoExit","-ExecutionPolicy","Bypass","-File","$scriptPath"
  exit
}

Write-Host 'Elevated. Running packaging...'
Set-Location (Split-Path $PSScriptRoot -Parent)
Write-Host "Working directory: $(Get-Location)"

# Optional clean of previous unpacked dir to avoid file lock errors
Remove-Item .\dist\win-unpacked -Recurse -Force -ErrorAction SilentlyContinue

Write-Host 'Installing dependencies (ensuring up to date)...'
npm install | Write-Host

Write-Host 'Building & packaging (npm run dist)...'
npm run dist

Write-Host 'Done. Artifacts (if success) under dist\:'
Write-Host '  - Installer EXE (NSIS)'
Write-Host '  - Portable EXE'
Write-Host '  - win-unpacked directory'