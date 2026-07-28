#!/usr/bin/env sh
set -eu

if ! command -v npm >/dev/null 2>&1; then
  echo "Empirical requires Node.js 20+ and npm." >&2
  exit 1
fi

npm install -g empirical-sdd@latest
empirical --version
