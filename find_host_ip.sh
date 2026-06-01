#!/bin/bash

echo "=== IP du gateway depuis container ==="
docker exec tipforgood_frontend_1 ip route | head -10

echo ""
echo "=== Networks Docker ==="
docker network ls

echo ""
echo "=== Network tipforgood ==="
docker inspect tipforgood_frontend_1 --format "{{json .NetworkSettings.Networks}}" 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
for net, info in data.items():
    print(f'Network: {net}')
    print(f'  Gateway: {info.get(\"Gateway\",\"?\")}')
    print(f'  IPAddress: {info.get(\"IPAddress\",\"?\")}')
"

echo ""
echo "=== Test depuis container avec IP correcte ==="
GW=$(docker exec tipforgood_frontend_1 ip route | grep default | awk '{print $3}')
echo "Gateway IP: $GW"
docker exec tipforgood_frontend_1 curl -sf --max-time 5 "http://${GW}:3003/api/health" && echo HOST_OK || echo HOST_FAIL
