#!/bin/bash
set -e
export PATH=~/.npm-global/bin:$PATH

echo "=== Verification dist ==="
ls ~/apps/comptaos/frontend/dist/
grep -o '/comptaos/assets[^"]*' ~/apps/comptaos/frontend/dist/index.html | head -3

echo ""
echo "=== Creation .env ==="
mkdir -p ~/apps/comptaos/workspace
printf 'NODE_ENV=production\nPORT=3002\nHOST=0.0.0.0\nAUTH_ENABLED=true\nWORKSPACE_PATH=/home/benoit/apps/comptaos/workspace\n' > ~/apps/comptaos/backend/.env
cat ~/apps/comptaos/backend/.env
echo ENV_OK

echo ""
echo "=== Demarrage PM2 ==="
cd ~/apps/comptaos/backend
pm2 delete comptaos 2>/dev/null || true
pm2 start dist/index.js --name comptaos --cwd /home/benoit/apps/comptaos/backend
sleep 2
pm2 status
pm2 save
echo PM2_OK

echo ""
echo "=== Test backend local ==="
sleep 2
curl -sf http://127.0.0.1:3002/api/health && echo HEALTH_OK || echo HEALTH_FAIL
