#!/bin/bash
echo "=== Cert dans le container ==="
docker exec tipforgood_frontend_1 openssl x509 -in /etc/nginx/ssl/cert.pem -noout -dates -subject 2>/dev/null || echo "Pas de cert dans /etc/nginx/ssl/"

echo ""
echo "=== Volume mounts du container ==="
docker inspect tipforgood_frontend_1 --format "{{json .Mounts}}" | python3 -c "
import json, sys
mounts = json.load(sys.stdin)
for m in mounts:
    print(f'  Type:{m.get(\"Type\",\"?\")} Source:{m.get(\"Source\",\"?\")} -> {m.get(\"Destination\",\"?\")}')
"

echo ""
echo "=== Certbot disponible ? ==="
which certbot 2>/dev/null && certbot --version || echo "certbot non installe"

echo ""
echo "=== Certs Let's Encrypt sur le host ==="
ls /etc/letsencrypt/live/ 2>/dev/null || echo "pas de /etc/letsencrypt/live"

echo ""
echo "=== Docker compose file tipforgood ==="
find /home/benoit /var/www /opt -name "docker-compose*.yml" 2>/dev/null | xargs grep -l "tipforgood" 2>/dev/null | head -5

echo ""
echo "=== Expiration du cert ==="
docker exec tipfrogood_frontend_1 openssl x509 -in /etc/nginx/ssl/cert.pem -noout -enddate 2>/dev/null || \
docker exec tipforgood_frontend_1 openssl x509 -in /etc/nginx/ssl/cert.pem -noout -enddate 2>/dev/null || echo "erreur lecture cert"
