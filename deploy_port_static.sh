#!/bin/bash
set -e
export PATH=~/.npm-global/bin:$PATH

echo "=== Changement port vers 3003 ==="
# Mettre a jour .env
cat > ~/apps/comptaos/backend/.env << 'ENVEOF'
NODE_ENV=production
PORT=3003
HOST=0.0.0.0
AUTH_ENABLED=true
WORKSPACE_PATH=/home/benoit/apps/comptaos/workspace
ENVEOF
cat ~/apps/comptaos/backend/.env
echo ENV_UPDATED

echo ""
echo "=== Redemarrage PM2 ==="
pm2 restart comptaos
sleep 3
pm2 status

echo ""
echo "=== Test sante backend ==="
curl -sf http://127.0.0.1:3003/api/health && echo HEALTH_OK || echo HEALTH_FAIL

echo ""
echo "=== Copie static vers Docker ==="
mkdir -p /tmp/comptaos_static
cp -r ~/apps/comptaos/frontend/dist/. /tmp/comptaos_static/
docker cp /tmp/comptaos_static/. tipforgood_frontend_1:/usr/share/nginx/html/comptaos/
echo STATIC_COPIED

echo ""
echo "=== Verification dans Docker ==="
docker exec tipforgood_frontend_1 ls /usr/share/nginx/html/comptaos/
docker exec tipforgood_frontend_1 grep -o "/comptaos/assets[^\"]*" /usr/share/nginx/html/comptaos/index.html | head -2
echo VERIFY_OK
