$ErrorActionPreference = "Stop"

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw "Empirical requires Rust/Cargo 1.85 or newer."
}

cargo install --locked --force --git https://github.com/MateoCerquetella/empirical-sdd empirical-sdd
empirical agents sync

Write-Host "Empirical and all supported global agent command packs are installed."
