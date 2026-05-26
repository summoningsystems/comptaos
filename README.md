# ComptaOS

> **Le VS Code de la comptabilité.** Local-first, open-source, IA copilote intégrée.

![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-1.0.0--beta-orange)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![Stack](https://img.shields.io/badge/stack-React%20%2B%20Fastify%20%2B%20Electron-blue)

Vos données comptables vous appartiennent. Pas de cloud imposé, pas de lock-in, pas d'abonnement obligatoire. ComptaOS tourne entièrement sur votre machine avec une synchronisation Git optionnelle.

---

## ✨ Fonctionnalités

| Module | Description |
|--------|-------------|
| 📊 Dashboard | KPIs en temps réel, graphiques CA / charges |
| 🧾 Factures & Devis | Création, envoi, suivi de statut, relances automatiques |
| 💰 TVA | Calcul automatique, export CA3 PDF |
| 📈 Bilan / P&L | Compte de résultat PCG, export PDF |
| 🏦 Trésorerie | Prévisionnel de trésorerie |
| 🔗 Rapprochement | Import relevé bancaire, matching automatique |
| 🤖 IA Copilote | Suggestions de catégorie, analyse des dépenses |
| 📋 Multi-entreprises | Gérez plusieurs structures en parallèle |
| 🔒 Chiffrement | AES-256-GCM — vos données chiffrées, clé jamais stockée |
| 🧩 Plugins | Système d'extensions (vm sandbox), marketplace à venir |
| 📱 PWA | Installable comme app, fonctionne offline |
| 🖥️ Electron | Application desktop native Windows / macOS / Linux |

---

## 🚀 Démarrage rapide

```bash
# 1. Cloner et installer
git clone https://github.com/VOTRE_USERNAME/comptaos.git
cd comptaos
npm run install:all

# 2. Lancer en développement
npm run dev
# Frontend → http://localhost:5173
# Backend  → http://localhost:3001/api

# 3. Ou construire l'app desktop
npm run electron:build
```

---

## 💼 Plans

| | Gratuit | Pro (79 € one-shot) | Pro+ (9 €/mois) |
|---|:---:|:---:|:---:|
| Transactions illimitées | ✅ | ✅ | ✅ |
| Factures & Devis | ✅ | ✅ | ✅ |
| Export PDF (TVA + Bilan) | ✅ | ✅ | ✅ |
| Multi-entreprises | 1 | ∞ | ∞ |
| Connexion bancaire PSD2 | ❌ | ✅ | ✅ |
| Templates premium | ❌ | ✅ | ✅ |
| Sync cloud chiffrée | ❌ | ❌ | ✅ |
| IA copilote illimitée | ❌ | ❌ | ✅ |
| Support prioritaire | ❌ | 30 jours | ✅ |

**[→ Gérer votre licence dans l'app : Paramètres → Plans & Licence]**

---

## 🏗️ Architecture

```
compta_code/
├── backend/          # Fastify 4 + TypeScript (ESM) — port 3001
│   └── src/
│       ├── routes/   # 25+ routes : invoices, vat, reports, plugins...
│       └── services/ # fileSystem, licenseService, encryptionService...
├── frontend/         # React 18 + Vite 5 + TailwindCSS + Zustand
│   └── src/
│       ├── components/  # 25+ vues
│       └── stores/      # appStore (Zustand)
├── electron/         # Main process Electron (CommonJS)
├── e2e/              # Tests Playwright
└── workspace/        # Données locales (YAML/JSON, ignoré par git)
```

---

## ⚙️ Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `WORKSPACE_PATH` | `../workspace` | Chemin absolu du workspace |
| `PORT` | `3001` | Port du backend |
| `LOCAL_API_KEY` | _(vide)_ | Clé API optionnelle pour sécuriser l'accès |

---

## 🗺️ Roadmap

- [x] Multi-entreprises + onboarding wizard
- [x] Factures / Devis avec relances automatiques
- [x] Export PDF TVA (CA3) + Bilan comptable
- [x] Système de plugins (sandbox vm)
- [x] PWA installable + mode offline
- [x] Chiffrement AES-256-GCM du workspace
- [x] Spreadsheet avec Web Worker (HyperFormula)
- [x] Application Electron (desktop natif)
- [x] Tests E2E Playwright
- [ ] Connexion bancaire PSD2 (Bridge API)
- [ ] Télédéclaration URSSAF auto-entrepreneur
- [ ] Dashboard multi-clients (cabinet comptable)
- [ ] Marketplace de plugins
- [ ] Application mobile (React Native)

---

## 🤝 Contribuer

```bash
# Fork + clone
git clone https://github.com/VOTRE_USERNAME/comptaos.git

# Créer une branche
git checkout -b feature/ma-fonctionnalite

# Tester
npm run test:e2e

# Pull Request sur main
```

---

## 📄 Licence

MIT — Voir [LICENSE](LICENSE)

---

*ComptaOS n'est pas un logiciel de comptabilité certifié. Il est conçu comme outil de pilotage et de préparation comptable. Pour les déclarations officielles, consultez un expert-comptable.*
