#!/bin/bash
set -e
echo "=== Copie nouveaux assets statiques ==="
cp -r ~/apps/comptaos/frontend/dist/. /tmp/comptaos_static_new/
docker cp /tmp/comptaos_static_new/. tipforgood_frontend_1:/usr/share/nginx/html/comptaos/
echo COPIED

echo ""
echo "=== Verification ==="
docker exec tipforgood_frontend_1 ls /usr/share/nginx/html/comptaos/
echo DONE
