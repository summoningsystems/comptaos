#!/bin/bash
echo "=== Crontab root ==="
sudo crontab -l

echo ""
echo "=== Crontab benoit ==="
crontab -l 2>/dev/null || echo "(vide)"

echo ""
echo "=== Cert expiration actuel ==="
openssl x509 -in /opt/TipForGood/frontend/ssl/cert.pem -noout -enddate 2>/dev/null || echo "cert non lisible"
