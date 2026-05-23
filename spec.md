Spécification MVP — ComptaOS / “VSCode de la compta”
Vision produit

Créer une application web locale-first inspirée de VS Code / Obsidian permettant de gérer sa comptabilité personnelle et professionnelle via des fichiers texte structurés, enrichis par une IA copilote.

Le système ne cherche pas à remplacer un expert-comptable ni à être un ERP complet, mais à fournir :

une vision claire des finances
une organisation simple et versionnable
une automatisation intelligente
un assistant conversationnel financier/comptable

L’utilisateur reste propriétaire de ses données via des fichiers lisibles (.md, .yaml, .json, .csv).

Objectifs MVP

Le MVP doit permettre :

d’importer des transactions bancaires
de stocker les données sous forme de fichiers structurés
de catégoriser automatiquement les opérations
de calculer une estimation TVA / charges
d’avoir un dashboard simple
d’interagir avec un copilote IA
d’éditer les données dans une interface type VSCode
Positionnement produit
Ce que le produit EST
assistant comptable intelligent
cockpit financier personnel
outil local-first
système basé sur fichiers + IA
Ce que le produit N’EST PAS
logiciel comptable certifié
solution de paie
ERP
télédéclaration officielle
Stack technique recommandée
Frontend
React
TypeScript
Vite
TailwindCSS
Monaco Editor (éditeur VSCode)
Backend
Go + Fiber
OU
Node.js + Fastify/Nest
Base de données

Aucune DB obligatoire pour le MVP.

Le filesystem est la source de vérité.

Optionnel :

SQLite pour cache/indexation
Architecture générale
Workspace

L’utilisateur ouvre un “workspace” contenant tous ses fichiers financiers.

Exemple :

/workspace
    /transactions
    /invoices
    /vat
    /reports
    /attachments
    settings.yaml
Format des données
Transactions

Format recommandé : YAML ou Markdown frontmatter.

Exemple :

id: txn_0001
date: 2026-05-20
label: OVH
amount_ht: 10.83
vat: 2.16
amount_ttc: 12.99
currency: EUR
category: hosting
account: business
status: validated
attachment: invoice_ovh_may.pdf
notes: Hébergement VPS
Factures
id: inv_0001
supplier: OVH
date: 2026-05-20
vat_rate: 20
amount_ht: 10.83
amount_ttc: 12.99
category: hosting
file: attachments/invoice.pdf
Fonctionnalités MVP
1. Workspace Explorer
Objectif

Interface type VSCode permettant :

navigation fichiers
édition
création
suppression
Features
arbre de fichiers
onglets
édition YAML/MD
sauvegarde automatique
Librairie

Monaco Editor

2. Import bancaire CSV
Objectif

Importer un export bancaire standard.

Features
drag & drop CSV
mapping colonnes
détection :
date
montant
label
création automatique des transactions
Résultat

Génération des fichiers transaction.

3. Catégorisation automatique IA
Objectif

Proposer une catégorie automatiquement.

Catégories MVP
hosting
software
salary
travel
restaurant
taxes
equipment
subscription
misc
Fonctionnement

LLM reçoit :

label
montant
historique

Puis propose :

catégorie
taux TVA probable
type de charge

L’utilisateur valide.

4. OCR Factures
Objectif

Lire automatiquement les PDF.

Solutions possibles
Mistral OCR
AWS Textract
Tesseract (offline)
Extraction
fournisseur
date
TVA
montant
5. Dashboard Financier
Widgets MVP
CA mensuel
dépenses
TVA estimée
trésorerie
top catégories
évolution mensuelle
Charts
Recharts
6. Copilote IA
Objectif

Assistant conversationnel contextuel.

Exemple de questions
“Combien de TVA je dois probablement ce trimestre ?”
“Quels sont mes plus gros postes de dépense ?”
“Cette dépense semble-t-elle déductible ?”
“Quels abonnements augmentent ?”
Fonctionnement

Le LLM reçoit :

fichiers workspace
contexte financier
historique récent
7. Recherche globale
Fonctionnalités

Recherche :

texte
catégorie
fournisseur
montant

Inspirée de VSCode.

8. Tags & Métadonnées
Support
tags:
  - deductible
  - recurring
9. Génération rapports
MVP

Export Markdown/PDF :

dépenses mensuelles
TVA
récap activité
IA — Architecture
Modèle

Abstraction provider :

OpenAI
Claude
Mistral
Ollama local
Capacité requise
classification
résumé
extraction
dialogue
Local-first
Important

Les données doivent :

rester accessibles sans cloud
pouvoir être sauvegardées via Git
rester lisibles humainement
Git Integration (phase 2)
Objectif

Versionning complet.

Features :

historique
rollback
audit
Sécurité
MVP
stockage local
chiffrement optionnel
aucun partage public
Non objectifs MVP

❌ Paie
❌ DSN
❌ Déclarations fiscales officielles
❌ Comptabilité certifiée
❌ Multi-entreprise complexe
❌ Collaboration temps réel

UX cible

Mélange entre :

VS Code
Obsidian
Notion
dashboard financier
Priorités de développement
Phase 1
Workspace
édition fichiers
import CSV
dashboard simple
Phase 2
IA catégorisation
OCR
copilote conversationnel
Phase 3
Git
plugins
automatisations avancées
Vision long terme

Créer un environnement financier personnel programmable, transparent et assisté par IA, où les données restent sous le contrôle de l’utilisateur plutôt qu’enfermées dans un ERP opaque.