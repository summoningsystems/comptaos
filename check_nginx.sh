#!/bin/bash
echo "=== IP Docker bridge ==="
ip addr show docker0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1 || echo "docker0 not found"
ip route | grep docker 2>/dev/null | head -3

echo ""
echo "=== Config Nginx actuelle ==="
docker exec tipforgood_frontend_1 cat /etc/nginx/conf.d/default.conf
