#!/bin/bash
echo "=== Test frontend ==="
curl -k -sf --max-time 10 https://tipforgood.com/comptaos/ | grep -o '<title>[^<]*</title>'

echo ""
echo "=== Test auth status ==="
curl -k -sf --max-time 10 https://tipforgood.com/comptaos/api/auth/status

echo ""
echo "=== Test SPA routing (dashboard) ==="
curl -k -sf -o /dev/null -w "%{http_code}" --max-time 10 https://tipforgood.com/comptaos/dashboard
echo ""

echo ""
echo "=== Conteneurs actifs ==="
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "tipforgood|comptaos"
