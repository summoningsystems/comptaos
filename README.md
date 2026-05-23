# ComptaOS — MVP Phase 1

> VSCode de la comptabilité — local-first, fichiers YAML, IA copilote (Phase 2).

## Lancement rapide

```bash
# 1. Installer toutes les dépendances
npm run install:all

# 2. Démarrer backend + frontend en parallèle
npm run dev
```

- **Frontend** : http://localhost:5173
- **Backend API** : http://localhost:3001/api

## Structure

```
compta_code/
├── backend/          # Fastify + TypeScript
│   └── src/
│       ├── routes/   # files, transactions, import, dashboard
│       ├── services/ # fileSystem, csvParser, transactionService, dashboardService
│       └── types/
├── frontend/         # React + Vite + Tailwind + Monaco
│   └── src/
│       ├── api/      # client axios
│       ├── components/
│       │   ├── Dashboard/
│       │   ├── Editor/      # Monaco
│       │   ├── Explorer/    # FileTree
│       │   ├── Import/      # CsvImporter (drag & drop)
│       │   ├── Layout/      # Sidebar, TabBar, StatusBar
│       │   └── Transactions/
│       ├── stores/   # Zustand
│       └── types/
└── workspace/        # Données locales (fichiers YAML)
    ├── transactions/
    ├── invoices/
    ├── vat/
    ├── reports/
    ├── attachments/
    └── settings.yaml
```

## Variable d'environnement

| Variable         | Défaut                  | Description                      |
|------------------|-------------------------|----------------------------------|
| `WORKSPACE_PATH` | `../workspace` (relatif au backend) | Chemin absolu du workspace |
| `PORT`           | `3001`                  | Port du backend                  |

## Phase 1 — Features disponibles

- [x] Workspace explorer (arbre de fichiers)
- [x] Éditeur Monaco (YAML, Markdown, JSON…)
- [x] Import CSV avec drag & drop + mapping de colonnes
- [x] Vue Transactions avec catégorisation et changement de statut
- [x] Dashboard : KPIs, évolution mensuelle, top catégories

## Phase 2 — Roadmap

- [ ] Catégorisation automatique via Anthropic Claude
- [ ] OCR factures PDF (Mistral OCR)
- [ ] Copilote IA conversationnel
- [ ] Intégration Git (versioning)
