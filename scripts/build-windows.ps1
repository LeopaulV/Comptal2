# Build local de l'installeur NSIS (.exe) signé pour l'updater GitHub.
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$keyPath = Join-Path $root "src-tauri\keys\comptal21.key"
if (-not (Test-Path $keyPath)) {
  throw "Clé de signature introuvable: $keyPath"
}
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = $keyPath
if (-not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
}
Set-Location $root
npm run tauri:build:windows
