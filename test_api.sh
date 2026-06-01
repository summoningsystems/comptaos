#!/bin/bash
export PATH=~/.npm-global/bin:$PATH

echo "=== Test backend direct 127.0.0.1:3003 ==="
curl -sf --max-time 5 http://127.0.0.1:3003/api/health && echo DIRECT_OK || echo DIRECT_FAIL

echo ""
echo "=== PM2 status ==="
pm2 status

echo ""
echo "=== PM2 logs recents ==="
pm2 logs comptaos --lines 5 --nostream 2>&1 | tail -10

echo ""
echo "=== Test via Docker container (bridge) ==="
docker exec tipforgood_frontend_1 curl -sf --max-time 5 http://172.17.0.1:3003/api/health && echo DOCKER_BRIDGE_OK || echo DOCKER_BRIDGE_FAIL

echo ""
echo "=== Port 3003 ==="
ss -tlnp | grep ':3003' || echo "port 3003 pas trouve"
