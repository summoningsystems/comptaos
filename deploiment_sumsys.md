# 🚀 Guide de Déploiement - Nouvelle Application sur Serveur TipForGood

## 📋 Contexte Serveur

- **Serveur héberge déjà** : "tip for good" et "realmnote"
- **Infrastructure** : Docker avec container Nginx sur port 80/443
- **Configuration actuelle** : Realmnote déployé en sous-dossier `/realmnote`
- **URL** : `https://tipforgood.com`

---

## 🎯 Stratégie de Déploiement

### Structure Recommandée

```
/var/www/
├── tipforgood/          # Site principal (container Docker)
├── realmnote/           # Application existante
└── [nom-app]/           # Votre nouvelle application
    ├── frontend/
    │   ├── dist/        # Build de production
    │   ├── src/
    │   ├── vite.config.ts
    │   └── package.json
    └── ...
```

### URL Finale

`https://tipforgood.com/[nom-app]`

---

## ⚙️ Étape 1 : Configuration du Build

### 1.1 Modifier `vite.config.ts`

**CRUCIAL** : Configurer le `base` pour le sous-dossier

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/[nom-app]/',  // ⚠️ Remplacer [nom-app] par le vrai nom
});
```

### 1.2 Créer `.env.production`

```bash
# Dans /var/www/[nom-app]/frontend/
nano .env.production
```

Exemple de contenu :
```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre_cle_anon_publique
VITE_API_URL=https://tipforgood.com/api
```

**⚠️ Important** : 
- Ne JAMAIS committer `.env.production`
- Vérifier qu'il est dans `.gitignore`

---

## 🔨 Étape 2 : Build de l'Application

### 2.1 Sur le Serveur

```bash
# Se connecter en SSH
ssh user@tipforgood.com

# Naviguer vers le dossier
cd /var/www/[nom-app]/frontend

# Installer les dépendances
npm install

# Builder pour production
npm run build
```

### 2.2 Vérifier le Build

```bash
# Vérifier que dist/ existe
ls -la dist/

# Vérifier que index.html contient le bon basePath
cat dist/index.html | grep assets
# Doit afficher : /[nom-app]/assets/... et PAS /assets/...
```

---

## 🐳 Étape 3 : Intégration au Container Docker

### 3.1 Copier le Build dans le Container

```bash
# Créer le dossier dans le container
sudo docker exec tipforgood_frontend_1 mkdir -p /usr/share/nginx/html/[nom-app]

# Copier le contenu de dist/
sudo docker cp dist/. tipforgood_frontend_1:/usr/share/nginx/html/[nom-app]/
```

### 3.2 Vérifier la Copie

```bash
# Vérifier que les fichiers sont présents
sudo docker exec tipforgood_frontend_1 ls -la /usr/share/nginx/html/[nom-app]/

# Vérifier le dossier assets
sudo docker exec tipforgood_frontend_1 ls -la /usr/share/nginx/html/[nom-app]/assets/
```

---

## 🌐 Étape 4 : Configuration Nginx

### 4.1 Extraire la Config Actuelle

```bash
sudo docker exec tipforgood_frontend_1 cat /etc/nginx/conf.d/default.conf > /tmp/default.conf
```

### 4.2 Modifier la Configuration

```bash
nano /tmp/default.conf
```

**Ajouter dans le bloc `server` (port 443)**, après la section `location /realmnote` :

```nginx
# [Nom App]
location /[nom-app]/ {
    alias /usr/share/nginx/html/[nom-app]/;
    try_files $uri $uri/ /[nom-app]/index.html;
}
```

**Configuration complète exemple** :

```nginx
server {
    listen 443 ssl http2;
    server_name tipforgood.com;

    # ... certificats SSL ...

    root /usr/share/nginx/html;
    index index.html;

    # Site principal
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Realmnote
    location /realmnote/ {
        alias /usr/share/nginx/html/realmnote/;
        try_files $uri $uri/ /realmnote/index.html;
    }

    # Nouvelle App
    location /[nom-app]/ {
        alias /usr/share/nginx/html/[nom-app]/;
        try_files $uri $uri/ /[nom-app]/index.html;
    }

    # Proxy backend (si nécessaire)
    location /api/ {
        proxy_pass http://backend:8080;
        # ... headers proxy ...
    }

    # Cache assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
```

### 4.3 Appliquer la Configuration

```bash
# Copier la config dans le container
sudo docker cp /tmp/default.conf tipforgood_frontend_1:/etc/nginx/conf.d/default.conf

# Tester la configuration
sudo docker exec tipforgood_frontend_1 nginx -t

# Si OK, redémarrer le container
sudo docker restart tipforgood_frontend_1
```

---

## 🔧 Étape 5 : Adaptation du Code (React Router)

### 5.1 Modifier `main.tsx` (si SPA avec routes)

```typescript
// Gérer le basePath pour les routes
const basePath = import.meta.env.BASE_URL || '/';
const fullPath = window.location.pathname;

// Enlever le basePath pour obtenir le chemin relatif
const path = fullPath.startsWith(basePath) 
  ? fullPath.slice(basePath.length - 1) // -1 pour garder le / initial
  : fullPath;

// Utiliser 'path' pour vos routes
const isHomePage = path === '/';
const isAboutPage = path === '/about';
```

### 5.2 Génération de Liens

**Tous les liens générés** doivent inclure le basePath :

```typescript
// ❌ INCORRECT
const link = `${window.location.origin}/page/123`;

// ✅ CORRECT
const basePath = import.meta.env.BASE_URL || '/';
const link = `${window.location.origin}${basePath}page/123`;
```

**Exemples concrets** :

```typescript
// Lien de partage
const handleCopyLink = (id: string) => {
  const basePath = import.meta.env.BASE_URL || '/';
  const link = `${window.location.origin}${basePath}item/${id}`;
  navigator.clipboard.writeText(link);
};

// Redirection programmatique
const navigate = (route: string) => {
  const basePath = import.meta.env.BASE_URL || '/';
  window.location.href = `${basePath}${route}`;
};
```

---

## ✅ Étape 6 : Tests et Validation

### 6.1 Checklist Pré-déploiement

- [ ] `base: '/[nom-app]/'` configuré dans `vite.config.ts`
- [ ] `.env.production` créé avec bonnes variables
- [ ] `npm run build` réussi sans erreurs
- [ ] `dist/index.html` vérifié (chemins assets corrects)

### 6.2 Checklist Déploiement

- [ ] Fichiers copiés dans container Docker
- [ ] Configuration Nginx ajoutée
- [ ] `nginx -t` réussi (pas d'erreurs de syntaxe)
- [ ] Container Docker redémarré

### 6.3 Tests Fonctionnels

**Test 1 : Page charge**
```bash
curl -I https://tipforgood.com/[nom-app]
# Doit retourner : 200 OK
```

**Test 2 : Navigateur**
1. Ouvrir : `https://tipforgood.com/[nom-app]`
2. Vider cache (Ctrl+Shift+R)
3. Vérifier console (F12) : **aucune erreur 404**
4. Vérifier Network : assets chargent depuis `/[nom-app]/assets/`

**Test 3 : Routes (si SPA)**
- Naviguer entre différentes pages
- Rafraîchir (F5) : doit rester sur la bonne page
- Vérifier URL dans barre d'adresse

**Test 4 : Liens Générés**
- Tester tous les boutons "Copier lien"
- Vérifier format : `https://tipforgood.com/[nom-app]/...`
- Tester les liens copiés

**Test 5 : Mobile**
- Ouvrir sur téléphone
- Vérifier responsive
- Tester navigation

### 6.4 En Cas de Problème

**Page blanche** :
1. F12 → Console → Chercher erreurs 404
2. Vérifier `dist/index.html` : chemins assets corrects ?
3. Vérifier container : fichiers présents ?
   ```bash
   sudo docker exec tipforgood_frontend_1 ls -la /usr/share/nginx/html/[nom-app]/
   ```
4. Rebuild avec `npm run build`
5. Vider cache navigateur complètement

**Erreur 404 sur routes** :
- Vérifier `try_files` dans config Nginx
- Doit finir par `/[nom-app]/index.html`

**Assets 404** :
- Vérifier `base: '/[nom-app]/'` dans vite.config.ts
- Rebuild nécessaire
- Vérifier `index.html` : chemins corrects

**Nginx ne démarre pas** :
```bash
# Voir les logs
sudo docker logs tipforgood_frontend_1

# Tester config
sudo docker exec tipforgood_frontend_1 nginx -t

# Vérifier syntaxe de default.conf
```

---

## 🔄 Étape 7 : Mises à Jour Futures

### Script de Déploiement Automatique

Créer `/var/www/[nom-app]/deploy.sh` :

```bash
#!/bin/bash

echo "🚀 Déploiement de [nom-app]..."

# Variables
APP_NAME="[nom-app]"
CONTAINER="tipforgood_frontend_1"
BUILD_PATH="/var/www/$APP_NAME/frontend"

# Aller dans le dossier
cd $BUILD_PATH || exit

# Pull dernières modifications (si Git)
echo "📥 Pull Git..."
git pull origin main

# Installer dépendances
echo "📦 Installation des dépendances..."
npm install

# Build
echo "🔨 Build de production..."
npm run build

# Copier dans container
echo "📤 Upload vers container Docker..."
sudo docker exec $CONTAINER rm -rf /usr/share/nginx/html/$APP_NAME
sudo docker exec $CONTAINER mkdir -p /usr/share/nginx/html/$APP_NAME
sudo docker cp dist/. $CONTAINER:/usr/share/nginx/html/$APP_NAME/

# Vérifier
echo "✅ Vérification..."
sudo docker exec $CONTAINER ls -la /usr/share/nginx/html/$APP_NAME/ | head -10

echo "🎉 Déploiement terminé !"
echo "🌐 URL : https://tipforgood.com/$APP_NAME"
```

Rendre exécutable :
```bash
chmod +x /var/www/[nom-app]/deploy.sh
```

Utilisation :
```bash
/var/www/[nom-app]/deploy.sh
```

---

## 🔐 Étape 8 : Permissions et Sécurité

### 8.1 Permissions Fichiers

```bash
# Propriétaire
sudo chown -R www-data:www-data /var/www/[nom-app]

# Permissions
sudo chmod -R 755 /var/www/[nom-app]

# .env.production doit être protégé
chmod 600 /var/www/[nom-app]/frontend/.env.production
```

### 8.2 Sécurité

- [ ] `.env.production` dans `.gitignore`
- [ ] Clés API en production (pas dev)
- [ ] HTTPS activé (déjà fait via certificat existant)
- [ ] CORS configuré si API externe
- [ ] Headers de sécurité (déjà dans config Nginx)

---

## 📊 Étape 9 : Monitoring

### Logs Nginx

```bash
# Logs d'accès
sudo docker exec tipforgood_frontend_1 tail -f /var/log/nginx/access.log | grep [nom-app]

# Logs d'erreurs
sudo docker exec tipforgood_frontend_1 tail -f /var/log/nginx/error.log
```

### Espace Disque

```bash
# Taille du build
du -sh /var/www/[nom-app]/frontend/dist/

# Taille dans container
sudo docker exec tipforgood_frontend_1 du -sh /usr/share/nginx/html/[nom-app]/
```

---

## 📝 Récapitulatif Commandes Rapides

```bash
# 1. Build
cd /var/www/[nom-app]/frontend
npm run build

# 2. Deploy dans container
sudo docker exec tipforgood_frontend_1 rm -rf /usr/share/nginx/html/[nom-app]
sudo docker exec tipforgood_frontend_1 mkdir -p /usr/share/nginx/html/[nom-app]
sudo docker cp dist/. tipforgood_frontend_1:/usr/share/nginx/html/[nom-app]/

# 3. Test (si config Nginx déjà faite)
curl -I https://tipforgood.com/[nom-app]
```

---

## 🆘 Support et Références

- **Documentation Realmnote** : Voir `DEPLOIEMENT_SERVEUR.md` pour référence
- **Nginx docs** : https://nginx.org/en/docs/
- **Vite base option** : https://vitejs.dev/config/shared-options.html#base
- **Docker exec** : https://docs.docker.com/engine/reference/commandline/exec/

---

## ✨ Exemple Complet

Pour une app nommée **"myapp"** :

```bash
# vite.config.ts
base: '/myapp/'

# Build
cd /var/www/myapp/frontend
npm run build

# Deploy
sudo docker cp dist/. tipforgood_frontend_1:/usr/share/nginx/html/myapp/

# Nginx config (ajouter)
location /myapp/ {
    alias /usr/share/nginx/html/myapp/;
    try_files $uri $uri/ /myapp/index.html;
}

# Test
curl https://tipforgood.com/myapp
```

**URL finale** : `https://tipforgood.com/myapp` ✅
