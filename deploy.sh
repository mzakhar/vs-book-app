#!/usr/bin/env bash
set -e
HOST="mzakhar@homeserver"
REMOTE="/opt/vs-book-app"

echo "Building..."
npm run build

echo "Syncing to homeserver..."
ssh "$HOST" "mkdir -p $REMOTE/frontend $REMOTE/backend"

# Copy built artifacts and package files
scp -r frontend/dist "$HOST:$REMOTE/frontend/"
scp -r backend/dist backend/package.json backend/package-lock.json "$HOST:$REMOTE/backend/"

# Copy server config files (only if changed)
scp deploy.sh vs-book-app.service nginx-vs-book-app.conf "$HOST:$REMOTE/"

echo "Installing prod deps and restarting..."
ssh "$HOST" "cd $REMOTE/backend && npm install --omit=dev && sudo systemctl restart vs-book-app"

echo "Done. App available at http://homeserver.local/books"
