#!/bin/bash
# Script de déploiement ComptaOS - tipforgood.com
set -e

APP="comptaos"
DIR="/var/www/$APP"
PORT=3002

echo "=== [1/6] Installation PM2 ==="
sudo npm install -g pm2

echo "=== [2/6] Création répertoire ==="
sudo mkdir -p "$DIR"
sudo chown benoit:benoit "$DIR"

echo "=== [3/6] Extraction de l'archive ==="
mkdir -p "$DIR"
tar -xzf /tmp/comptaos_deploy.tar.gz -C "$DIR"
rm /tmp/comptaos_deploy.tar.gz

echo "=== [4/6] Build backend ==="
cd "$DIR/backend"
npm install
npm run build

echo "=== [5/6] Build frontend ==="
cd "$DIR/frontend"
npm install
BASE_PATH="/$APP/" npm run build

echo "=== [6/6] Création du .env backend ==="
mkdir -p "$DIR/workspace"
cat > "$DIR/backend/.env" << EOF
NODE_ENV=production
PORT=$PORT
HOST=0.0.0.0
AUTH_ENABLED=true
WORKSPACE_PATH=$DIR/workspace
EOF

echo ""
echo "✓ Préparation terminée !"
echo "  App : $DIR"
echo "  Port backend : $PORT"
