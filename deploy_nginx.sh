#!/bin/bash
set -e

NGINX_CONF="/etc/nginx/conf.d/default.conf"
CONTAINER="tipforgood_frontend_1"

echo "=== Sauvegarde config actuelle ==="
docker exec $CONTAINER cat $NGINX_CONF > /tmp/nginx_backup.conf
cp /tmp/nginx_backup.conf /tmp/nginx_new.conf
echo "Backup OK"

# Verifier que comptaos n'est pas deja configure
if docker exec $CONTAINER grep -q "comptaos" $NGINX_CONF 2>/dev/null; then
    echo "COMPTAOS deja configure dans nginx - skip"
    exit 0
fi

echo "=== Insertion des blocs comptaos ==="
# Inserer les blocs avant "# Cache pour les assets statiques"
python3 - << 'PYEOF'
with open('/tmp/nginx_new.conf', 'r') as f:
    content = f.read()

comptaos_block = '''
    # COMPTAOS API
    location ^~ /comptaos/api/ {
        proxy_pass http://172.17.0.1:3003/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
    }

    # COMPTAOS Frontend
    location /comptaos/ {
        alias /usr/share/nginx/html/comptaos/;
        try_files $uri $uri/ /comptaos/index.html;
    }

'''

marker = '    # Cache pour les assets statiques'
if marker in content:
    content = content.replace(marker, comptaos_block + marker)
    with open('/tmp/nginx_new.conf', 'w') as f:
        f.write(content)
    print("Blocs insertés avec succes")
else:
    print("ERREUR: Marqueur non trouvé dans la config")
    exit(1)
PYEOF

echo ""
echo "=== Diff ==="
diff /tmp/nginx_backup.conf /tmp/nginx_new.conf || true

echo ""
echo "=== Copie vers container ==="
docker cp /tmp/nginx_new.conf $CONTAINER:$NGINX_CONF

echo ""
echo "=== Test config Nginx ==="
docker exec $CONTAINER nginx -t

echo ""
echo "=== Reload Nginx ==="
docker exec $CONTAINER nginx -s reload
echo NGINX_RELOADED

echo ""
echo "=== Verification config finale ==="
docker exec $CONTAINER grep -A 8 "comptaos" $NGINX_CONF | head -30
