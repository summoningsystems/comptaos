#!/bin/bash

echo "=== Verif curl dans container ==="
docker exec tipforgood_frontend_1 which curl || echo "curl absent"
docker exec tipforgood_frontend_1 which wget || echo "wget absent"

echo ""
echo "=== Test psy2000 API depuis container (temoins) ==="
docker exec tipforgood_frontend_1 curl -sf --max-time 5 http://172.17.0.1:3001/health 2>&1 || echo FAIL_3001

echo ""
echo "=== Routes docker0 ==="
ip route | grep docker

echo ""
echo "=== Interface docker0 ==="
ip addr show docker0

echo ""
echo "=== iptables INPUT sur port 3003 ==="
iptables -L INPUT -n 2>/dev/null | grep -E "3003|ACCEPT|DROP|REJECT" | head -10 || echo "iptables non disponible"

echo ""
echo "=== Test wget depuis container ==="
docker exec tipforgood_frontend_1 wget -q -O- --timeout=5 http://172.17.0.1:3003/api/health 2>&1 || echo WGET_FAIL
