#!/usr/bin/env bash
set -e
echo "Building..."
npm run build
echo "Syncing to homeserver..."
rsync -av --delete \
  --exclude 'node_modules' \
  --exclude 'backend/src' \
  --exclude '.git' \
  --exclude 'frontend/src' \
  --exclude 'frontend/node_modules' \
  ./ mzakhar@homeserver:/opt/vs-book-app/
echo "Installing prod deps and restarting..."
ssh mzakhar@homeserver \
  "cd /opt/vs-book-app/backend && npm install --omit=dev && sudo systemctl restart vs-book-app"
echo "Done. App available at http://homeserver.local/books"
