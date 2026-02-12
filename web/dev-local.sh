#!/bin/bash
# =============================================================================
# dev-local.sh — Run Next.js dev server from /tmp (bypasses iCloud Drive locks)
# =============================================================================
# Usage: ./dev-local.sh
#
# This script:
#   1. Kills any existing process on port 3005
#   2. Syncs source code from iCloud -> /tmp/TestRailKPIS_local
#   3. Installs dependencies if needed
#   4. Starts the dev server on http://localhost:3005
# =============================================================================

set -e

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
DEST_DIR="/tmp/TestRailKPIS_local"
PORT=3005

echo "🔄 Syncing source code to $DEST_DIR ..."
mkdir -p "$DEST_DIR"
rsync -a --delete \
  --exclude node_modules \
  --exclude .next \
  "$SRC_DIR/" "$DEST_DIR/"

echo "📦 Checking dependencies..."
cd "$DEST_DIR"
if [ ! -d node_modules ]; then
  echo "   Installing node_modules..."
  npm install --silent
else
  echo "   node_modules present, skipping install."
fi

# Kill any existing process on the port
echo "🧹 Clearing port $PORT..."
lsof -t -i:$PORT | xargs kill -9 2>/dev/null || true

echo "🚀 Starting Next.js dev server on http://localhost:$PORT"
echo "   Source: $SRC_DIR (iCloud)"
echo "   Runtime: $DEST_DIR (local /tmp)"
echo ""
echo "   ⚠️  Changes are NOT auto-synced."
echo "   Re-run this script after editing files in iCloud."
echo ""

npm run dev
