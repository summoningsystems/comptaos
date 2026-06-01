#!/bin/bash
set -e
REPO="$HOME/apps/comptaos"
NGINX_HTML=/usr/share/nginx/html/comptaos

echo "=== [1/5] git pull ==="
cd "$REPO"
git pull origin master

echo "=== [2/5] build frontend ==="
cd "$REPO/frontend"
npm install --prefer-offline --silent
NODE_OPTIONS=--experimental-global-webcrypto BASE_PATH=/comptaos/ npm run build

echo "=== [3/5] deploy frontend ==="
docker cp "$REPO/frontend/dist/." tipforgood_frontend_1:"$NGINX_HTML/"
docker exec tipforgood_frontend_1 nginx -s reload

echo "=== [4/5] build backend ==="
docker exec comptaos-backend sh -c 'cd /app && npx tsc --build'

echo "=== [5/5] restart backend ==="
docker restart comptaos-backend

echo "=== DEPLOY OK ==="
