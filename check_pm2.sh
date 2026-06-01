#!/bin/bash
export PATH=~/.npm-global/bin:$PATH

echo "=== Port 3002 ==="
ss -tlnp | grep ':3002' || echo "port 3002 check done"

echo ""
echo "=== PM2 logs ==="
pm2 logs comptaos --lines 15 --nostream 2>&1 | tail -20

echo ""
echo "=== PM2 status ==="
pm2 status
