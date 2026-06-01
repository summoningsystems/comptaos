#!/bin/bash

echo "=== UFW status ==="
ufw status 2>/dev/null || echo "ufw non disponible"

echo ""
echo "=== iptables DOCKER-USER ==="
iptables -L DOCKER-USER -n 2>/dev/null | head -20 || echo "DOCKER-USER non dispo"

echo ""
echo "=== iptables INPUT ==="
iptables -L INPUT -n 2>/dev/null | head -30 || echo "iptables INPUT non dispo"

echo ""
echo "=== iptables FORWARD ==="
iptables -L FORWARD -n 2>/dev/null | head -20 || echo "iptables FORWARD non dispo"

echo ""
echo "=== Test nc depuis container ==="
docker exec tipforgood_frontend_1 bash -c "echo '' | timeout 3 nc -z 172.18.0.1 3003 && echo PORT_OPEN || echo PORT_CLOSED" 2>/dev/null || echo "nc non disponible dans container"

echo ""
echo "=== Ports host visibles depuis container ==="
docker exec tipforgood_frontend_1 curl -sf --max-time 3 http://172.18.0.1:3001/ 2>&1 | head -3 && echo "3001 reachable" || echo "3001 not reachable from container via 172.18.0.1"
