#!/bin/bash
echo "=== Cert actuel sur le host ==="
openssl x509 -in /opt/TipForGood/frontend/ssl/cert.pem -noout -dates -subject -issuer 2>/dev/null || echo "Pas de cert ou openssl indispo"

echo ""
echo "=== docker-compose.yml TipForGood ==="
cat /opt/TipForGood/docker-compose.yml

echo ""
echo "=== Contenu /opt/TipForGood/frontend/ssl ==="
ls -la /opt/TipForGood/frontend/ssl/ 2>/dev/null || echo "repertoire non accessible"
