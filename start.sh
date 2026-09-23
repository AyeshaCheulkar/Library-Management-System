#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

echo
echo "  ========================================================"
echo "     LIBRARY MANAGEMENT SYSTEM"
echo "     Starting up. First run takes a few minutes."
echo "  ========================================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js is not installed, or not on PATH."
  echo "  Install the LTS build from https://nodejs.org and run this again."
  exit 1
fi

if [ ! -d backend/node_modules ]; then
  echo "  [1/4] Installing backend dependencies..."
  npm --prefix backend install
else
  echo "  [1/4] Backend dependencies present."
fi

if [ ! -d frontend/node_modules ]; then
  echo "  [2/4] Installing frontend dependencies..."
  npm --prefix frontend install
else
  echo "  [2/4] Frontend dependencies present."
fi

if [ ! -f frontend/build/index.html ]; then
  echo "  [3/4] Building the frontend. This is the slow part..."
  npm --prefix frontend run build
else
  echo "  [3/4] Frontend already built."
  echo "        Delete frontend/build to force a rebuild after changing the UI."
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  echo
  echo "  cloudflared is not installed, so there is no public URL to make."
  echo "  Install it with:"
  echo "      macOS:  brew install cloudflared"
  echo "      Linux:  see https://developers.cloudflare.com/cloudflare-tunnel/"
  echo
  echo "  Starting locally instead - open http://localhost:4000"
  echo
  exec npm --prefix backend run dev:local
fi

echo "  [4/4] Starting the server and opening a Cloudflare tunnel..."
echo

exec npm --prefix backend run tunnel
