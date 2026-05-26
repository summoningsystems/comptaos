import fs from "fs/promises";
import path from "path";
import { getWorkspaceRoot } from "./fileSystem.js";

export type Plan = "free" | "pro" | "pro_plus";

export interface License {
  plan: Plan;
  licenseKey: string | null;
  email: string | null;
  activatedAt: string | null;
  expiresAt: string | null; // null = perpétuelle
}

const LICENSE_FILE = () => path.join(getWorkspaceRoot(), ".license.json");

const DEFAULT_LICENSE: License = {
  plan: "free",
  licenseKey: null,
  email: null,
  activatedAt: null,
  expiresAt: null,
};

export async function getLicense(): Promise<License> {
  try {
    const raw = await fs.readFile(LICENSE_FILE(), "utf-8");
    const lic = JSON.parse(raw) as License;
    // Vérifier expiration éventuelle
    if (lic.expiresAt && new Date(lic.expiresAt) < new Date()) {
      return { ...DEFAULT_LICENSE };
    }
    return lic;
  } catch {
    return { ...DEFAULT_LICENSE };
  }
}

export async function activateLicense(key: string, email: string): Promise<License> {
  // Format clés : PRO-XXXX-XXXX-XXXX ou PROPLUS-XXXX-XXXX-XXXX
  const proPattern = /^PRO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  const proPlusPattern = /^PROPLUS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

  let plan: Plan;
  if (proPlusPattern.test(key)) {
    plan = "pro_plus";
  } else if (proPattern.test(key)) {
    plan = "pro";
  } else {
    throw new Error("Clé de licence invalide. Format attendu : PRO-XXXX-XXXX-XXXX");
  }

  const license: License = {
    plan,
    licenseKey: key,
    email,
    activatedAt: new Date().toISOString(),
    expiresAt: null,
  };

  await fs.writeFile(LICENSE_FILE(), JSON.stringify(license, null, 2));
  return license;
}

export async function deactivateLicense(): Promise<void> {
  await fs.writeFile(LICENSE_FILE(), JSON.stringify(DEFAULT_LICENSE, null, 2));
}

// ── Définition des plans (source de vérité partagée) ─────────────────────────
export const PLANS = [
  {
    id: "free",
    name: "Open-source",
    price: 0,
    priceLabel: "Gratuit",
    period: null,
    description: "Code source complet sur GitHub — installez-le où vous voulez",
    highlighted: false,
    cta: "Télécharger le binaire",
    ctaUrl: "https://github.com/VOTRE_USERNAME/comptaos/releases",
    note: "Nécessite Node.js ou utiliser le binaire compilé depuis les Releases",
    features: [
      "Toutes les fonctionnalités core",
      "Multi-entreprises illimité",
      "Factures, Devis, TVA, Bilan",
      "Export PDF (TVA + Bilan)",
      "Chiffrement local AES-256-GCM",
      "Sync Git manuelle",
      "Plugins communautaires",
      "IA copilote (votre propre clé API)",
    ],
    locked: [
      "Installateur sans Node.js",
      "Mises à jour automatiques",
      "Support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 39,
    priceLabel: "39 €",
    period: "one-shot",
    description: "Installateur natif + mises à jour + support — sans setup technique",
    highlighted: false,
    cta: "Acheter — 39 €",
    ctaUrl: "https://buy.stripe.com/PLACEHOLDER_PRO",
    note: "Achat unique. Mises à jour incluses 12 mois. Aucun abonnement.",
    features: [
      "Tout du plan Open-source",
      "Installateur natif (Windows / macOS / Linux)",
      "Mises à jour automatiques Electron (12 mois)",
      "5 templates de factures premium",
      "Support email 30 jours",
      "Aucune configuration technique",
    ],
    locked: [
      "IA copilote hébergée",
      "Sync cloud multi-appareils",
    ],
  },
  {
    id: "pro_plus",
    name: "Pro+",
    price: 9,
    priceLabel: "9 €",
    period: "mois",
    description: "IA et sync cloud incluses — on gère l'infrastructure pour vous",
    highlighted: true,
    cta: "S'abonner — 9 €/mois",
    ctaUrl: "https://buy.stripe.com/PLACEHOLDER_PROPLUS",
    note: "IA copilote hébergée par nos soins (pas besoin de clé OpenAI). Résiliable à tout moment.",
    features: [
      "Tout du plan Pro",
      "IA copilote hébergée (sans clé API perso)",
      "Sync cloud chiffrée multi-appareils",
      "Sauvegarde automatique quotidienne",
      "Mises à jour permanentes",
      "Support prioritaire",
    ],
    locked: [],
  },
];
