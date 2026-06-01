#!/bin/bash
export PATH=~/.npm-global/bin:$PATH

echo "=== .env backend ==="
cat ~/apps/comptaos/backend/.env

echo ""
echo "=== Contenu workspace ==="
ls -la ~/apps/comptaos/workspace/ 2>/dev/null || echo "workspace vide ou inexistant"

echo ""
echo "=== Recherche users.json ==="
find ~/apps /tmp -name "users.json" 2>/dev/null | head -5 || echo "non trouvé"

echo ""
echo "=== Test API auth/status ==="
curl -sf http://127.0.0.1:3003/api/auth/status

echo ""
echo "=== Logs backend recents ==="
docker logs comptaos-backend 2>&1 | tail -15
