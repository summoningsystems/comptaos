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
    name: "Gratuit",
    price: 0,
    priceLabel: "Gratuit",
    period: null,
    description: "Pour découvrir ComptaOS sans engagement",
    highlighted: false,
    cta: "Télécharger",
    ctaUrl: "https://github.com/VOTRE_USERNAME/comptaos/releases",
    features: [
      "1 entreprise",
      "Transactions illimitées",
      "Factures & Devis",
      "Export PDF (TVA + Bilan)",
      "Chiffrement local AES-256",
      "Sync Git manuel",
      "Plugins communautaires",
    ],
    locked: [],
  },
  {
    id: "pro",
    name: "Pro",
    price: 79,
    priceLabel: "79 €",
    period: "one-shot",
    description: "Achat unique, mises à jour 12 mois incluses",
    highlighted: false,
    cta: "Acheter — 79 €",
    ctaUrl: "https://buy.stripe.com/PLACEHOLDER_PRO",
    features: [
      "Tout du plan Gratuit",
      "Multi-entreprises illimité",
      "Templates métiers premium",
      "Connexion bancaire PSD2",
      "Relances automatiques avancées",
      "Support 30 jours inclus",
      "Mises à jour pendant 12 mois",
    ],
    locked: [],
  },
  {
    id: "pro_plus",
    name: "Pro+",
    price: 9,
    priceLabel: "9 €",
    period: "mois",
    description: "Pour les freelances et petites équipes",
    highlighted: true,
    cta: "S'abonner — 9 €/mois",
    ctaUrl: "https://buy.stripe.com/PLACEHOLDER_PROPLUS",
    features: [
      "Tout du plan Pro",
      "Sync cloud chiffrée (multi-appareils)",
      "IA copilote illimitée",
      "Dashboard expert-comptable",
      "Accès API publique",
      "Support prioritaire",
      "Mises à jour permanentes",
    ],
    locked: [],
  },
];
