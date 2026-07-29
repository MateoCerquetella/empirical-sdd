#!/usr/bin/env sh
set -eu

if ! command -v npm >/dev/null 2>&1; then
  echo "Empirical requires Node.js 20+ and npm." >&2
  exit 1
fi

if npm list -g --depth=0 --parseable @empirical/cli >/dev/null 2>&1; then
  echo "Removing the legacy @empirical/cli package that owns the empirical command..."
  npm uninstall -g @empirical/cli
fi

npm install -g empirical-sdd@latest
empirical --version
