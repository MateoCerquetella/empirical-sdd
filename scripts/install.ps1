$ErrorActionPreference = "Stop"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "Empirical requires Node.js 20+ and npm."
}

$legacyPackage = npm list -g --depth=0 --parseable "@empirical/cli" 2>$null
if ($LASTEXITCODE -eq 0 -and $legacyPackage) {
    Write-Host "Removing the legacy @empirical/cli package that owns the empirical command..."
    npm uninstall -g "@empirical/cli"
    if ($LASTEXITCODE -ne 0) {
        throw "Could not remove the legacy @empirical/cli package."
    }
}

npm install -g empirical-sdd@latest
if ($LASTEXITCODE -ne 0) {
    throw "Could not install empirical-sdd."
}
empirical --version
