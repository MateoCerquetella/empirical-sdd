#!/usr/bin/env sh
set -eu

if ! command -v cargo >/dev/null 2>&1; then
  echo "Empirical requires Rust/Cargo 1.85 or newer." >&2
  exit 1
fi

cargo install --locked --force --git https://github.com/MateoCerquetella/empirical-sdd empirical-sdd
empirical agents sync

echo "Empirical and all supported global agent command packs are installed."
