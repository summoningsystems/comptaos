#!/bin/bash
set -e

DOMAIN="tipforgood.com"
SSL_DIR="/opt/TipForGood/frontend/ssl"
CONTAINER="tipforgood_frontend_1"

echo "=== Cert actuel dans letsencrypt ==="
openssl x509 -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem -noout -dates 2>/dev/null || echo "Pas de cert dans letsencrypt"

echo ""
echo "=== Arret Nginx ==="
docker stop $CONTAINER

echo ""
echo "=== Renouvellement force ==="
certbot certonly \
  --standalone \
  --force-renewal \
  --non-interactive \
  --agree-tos \
  --preferred-challenges http \
  -d $DOMAIN \
  2>&1

echo ""
echo "=== Copie nouveaux certs ==="
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ${SSL_DIR}/cert.pem
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ${SSL_DIR}/key.pem
echo "Copie OK"

echo ""
echo "=== Redemarrage Nginx ==="
docker start $CONTAINER
sleep 2

echo ""
echo "=== Nouveau cert ==="
openssl x509 -in ${SSL_DIR}/cert.pem -noout -dates
