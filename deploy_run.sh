#!/bin/bash
# Script PM2 + Nginx ComptaOS
APP="comptaos"
DIR="/var/www/$APP"
PORT=3002
CONTAINER="tipforgood_frontend_1"

echo "=== [1/4] Démarrage PM2 ==="
cd "$DIR/backend"
pm2 delete "$APP" 2>/dev/null || true
pm2 start dist/index.js --name "$APP" --cwd "$DIR/backend"
pm2 save

echo "=== [2/4] Startup PM2 au boot ==="
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u benoit --hp /home/benoit 2>&1 | tail -3

echo "=== [3/4] Config Nginx ==="
# Trouver l'IP du gateway Docker (pour que le container nginx atteigne le host)
DOCKER_GW=$(ip addr show docker0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)
if [ -z "$DOCKER_GW" ]; then
  DOCKER_GW="172.17.0.1"
fi
echo "  → Docker gateway: $DOCKER_GW"

# Récupérer la config nginx actuelle
docker exec "$CONTAINER" cat /etc/nginx/conf.d/default.conf > /tmp/nginx_backup.conf
cp /tmp/nginx_backup.conf /tmp/nginx_new.conf

# Vérifier si le bloc comptaos existe déjà
if grep -q "location /$APP/" /tmp/nginx_new.conf; then
  echo "  → Bloc /$APP/ déjà présent, mise à jour..."
  # Supprimer l'ancien bloc comptaos
  sed -i "/# $APP/,/^    }/d" /tmp/nginx_new.conf
fi

# Injecter le nouveau bloc AVANT le dernier "}"
cat > /tmp/comptaos_nginx.conf << NGINX

    # ComptaOS
    location /$APP/ {
        proxy_pass http://$DOCKER_GW:$PORT/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cookie_path / /$APP/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
NGINX

# Insérer avant la dernière ligne du dernier bloc server
sed -i "/^}$/{ h; s/.*/$(cat /tmp/comptaos_nginx.conf | tr '\n' '\r')/; G; s/\r/\n/g; }" /tmp/nginx_new.conf 2>/dev/null || \
  # Fallback: append avant la dernière }
  head -n -1 /tmp/nginx_new.conf > /tmp/nginx_final.conf && \
  cat /tmp/comptaos_nginx.conf >> /tmp/nginx_final.conf && \
  echo "}" >> /tmp/nginx_final.conf && \
  mv /tmp/nginx_final.conf /tmp/nginx_new.conf

# Appliquer dans le container
docker cp /tmp/nginx_new.conf "$CONTAINER":/etc/nginx/conf.d/default.conf

# Test et reload
docker exec "$CONTAINER" nginx -t && \
  docker exec "$CONTAINER" nginx -s reload && \
  echo "✓ Nginx rechargé !"

echo "=== [4/4] Test ==="
sleep 2
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:$PORT/api/health && echo " ← backend OK"

echo ""
echo "✓ Déploiement terminé !"
echo "  URL : https://tipforgood.com/$APP/"
echo ""
echo "⚠ Pensez à ajouter vos clés API dans $DIR/backend/.env si nécessaire"
echo "  (ANTHROPIC_API_KEY, MISTRAL_API_KEY, etc.)"
