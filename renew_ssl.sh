#!/bin/bash
# Script renouvellement SSL tipforgood.com
# Méthode : webroot via le container Nginx existant
# Executer avec : sudo bash /tmp/renew_ssl.sh

set -e

DOMAIN="tipforgood.com"
SSL_DIR="/opt/TipForGood/frontend/ssl"
CONTAINER="tipforgood_frontend_1"
WEBROOT_HOST="/tmp/acme_webroot"
WEBROOT_CONTAINER="/usr/share/nginx/html"

echo "=== Méthode webroot - Configuration temporaire ==="

# 1. Créer le répertoire webroot sur le host
mkdir -p "${WEBROOT_HOST}/.well-known/acme-challenge"

# 2. Copier les fichiers webroot challenge dans le container
docker exec $CONTAINER mkdir -p /usr/share/nginx/html/.well-known/acme-challenge

# 3. Obtenir/renouveler le certificat via webroot
# Nginx sert déjà / -> /usr/share/nginx/html
# On va copier le challenge dans le container avant que certbot le vérifie

echo ""
echo "=== Méthode standalone (Nginx doit être arrêté temporairement) ==="
echo "Choix : --standalone nécessite d'arrêter le container pendant ~30 secondes"
echo ""
echo "Arrêt temporaire de Nginx..."
docker stop $CONTAINER

echo "Renouvellement certbot standalone..."
certbot certonly \
  --standalone \
  --non-interactive \
  --agree-tos \
  --preferred-challenges http \
  -d $DOMAIN \
  --email admin@tipforgood.com \
  2>&1

echo ""
echo "=== Copie des nouveaux certificats ==="
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ${SSL_DIR}/cert.pem
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ${SSL_DIR}/key.pem
echo "Certs copiés"

echo ""
echo "=== Redémarrage Nginx ==="
docker start $CONTAINER
sleep 2

echo ""
echo "=== Vérification ==="
openssl x509 -in ${SSL_DIR}/cert.pem -noout -dates
echo ""
echo "=== Test HTTPS ==="
curl -sf --max-time 10 https://$DOMAIN/ -o /dev/null -w "HTTP Status: %{http_code}\n" && echo OK
