#!/bin/bash
set -e

CONTAINER="tipforgood_frontend_1"

echo "=== Mise a jour proxy_pass comptaos dans Nginx ==="
docker exec $CONTAINER cat /etc/nginx/conf.d/default.conf > /tmp/nginx_current.conf

# Remplacer 172.17.0.1:3003 par comptaos-backend:3003
sed 's|http://172.17.0.1:3003/api/|http://comptaos-backend:3003/api/|g' /tmp/nginx_current.conf > /tmp/nginx_updated.conf

echo ""
echo "=== Diff ==="
diff /tmp/nginx_current.conf /tmp/nginx_updated.conf || true

echo ""
echo "=== Copie vers container ==="
docker cp /tmp/nginx_updated.conf $CONTAINER:/etc/nginx/conf.d/default.conf

echo ""
echo "=== Test config ==="
docker exec $CONTAINER nginx -t

echo ""
echo "=== Reload Nginx ==="
docker exec $CONTAINER nginx -s reload
echo NGINX_RELOADED

echo ""
echo "=== Test API via HTTPS ==="
sleep 1
curl -k -sf --max-time 10 https://tipforgood.com/comptaos/api/health && echo API_OK || echo API_FAIL
