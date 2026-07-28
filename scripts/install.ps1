$ErrorActionPreference = "Stop"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "Empirical requires Node.js 20+ and npm."
}

npm install -g @empirical/sdd@latest
empirical --version
