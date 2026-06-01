#!/bin/bash
set -e
export PATH=~/.npm-global/bin:$PATH

echo "=== Arret PM2 comptaos ==="
pm2 delete comptaos 2>/dev/null || true
pm2 save

echo ""
echo "=== Suppression ancien container si existe ==="
docker rm -f comptaos-backend 2>/dev/null || true

echo ""
echo "=== Demarrage backend en container Docker ==="
docker run -d \
  --name comptaos-backend \
  --restart unless-stopped \
  --network tipforgood_tipforgood-network \
  -v /home/benoit/apps/comptaos/backend:/app \
  -v /home/benoit/apps/comptaos/workspace:/workspace \
  -w /app \
  -e NODE_ENV=production \
  -e PORT=3003 \
  -e HOST=0.0.0.0 \
  -e AUTH_ENABLED=true \
  -e WORKSPACE_PATH=/workspace \
  node:18-alpine \
  node dist/index.js

echo ""
echo "=== Attente demarrage ==="
sleep 4

echo ""
echo "=== Status container ==="
docker ps --filter name=comptaos-backend --format "table {{.Names}}\t{{.Status}}\t{{.Networks}}"

echo ""
echo "=== Logs container ==="
docker logs comptaos-backend 2>&1 | tail -10

echo ""
echo "=== IP container dans le reseau ==="
docker inspect comptaos-backend --format "{{json .NetworkSettings.Networks}}" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for net, info in data.items():
    print(f'Network: {net}, IP: {info.get(\"IPAddress\",\"?\")}')
"

echo ""
echo "=== Test health depuis Nginx container ==="
docker exec tipforgood_frontend_1 curl -sf --max-time 5 http://comptaos-backend:3003/api/health && echo HEALTH_VIA_NAME_OK || echo HEALTH_VIA_NAME_FAIL
