/**
 * Service d'Open Banking via GoCardless (anciennement Nordigen)
 * Doc : https://bankaccountdata.gocardless.com/api/v2/
 *
 * Flux OAuth :
 *  1. getInstitutions(country) → liste des banques
 *  2. createRequisition(institutionId, redirectUrl) → { id, link }
 *  3. Utilisateur clique `link`, s'authentifie chez sa banque
 *  4. La banque redirige vers redirectUrl?ref={requisitionId}
 *  5. getRequisitionAccounts(requisitionId) → liste des account_id
 *  6. syncAccount(accountId) → transactions importées dans workspace
 */

import fs from "fs/promises";
import path from "path";
import { getWorkspaceRoot } from "./fileSystem.js";
import { getCompaniesRoot } from "./companiesService.js";

const GC_BASE = "https://bankaccountdata.gocardless.com/api/v2";

// ── Types GoCardless ──────────────────────────────────────────────────────────

interface GCToken {
  access: string;
  access_expires: number;
  refresh: string;
  refresh_expires: number;
}

interface GCInstitution {
  id: string;
  name: string;
  bic: string;
  transaction_total_days: string;
  countries: string[];
  logo: string;
}

interface GCRequisition {
  id: string;
  status: string;
  link: string;
  accounts: string[];
  institution_id: string;
  reference: string;
}

interface GCTransaction {
  transactionId?: string;
  bookingDate?: string;
  valueDate?: string;
  transactionAmount: { amount: string; currency: string };
  remittanceInformationUnstructured?: string;
  creditorName?: string;
  debtorName?: string;
}

// ── Stockage local ─────────────────────────────────────────────────────────────

export interface BankingConfig {
  secretId: string;
  secretKey: string;
}

export interface BankConnection {
  requisitionId: string;
  institutionId: string;
  institutionName: string;
  institutionLogo: string;
  accounts: BankAccount[];
  createdAt: string;
  status: string;
}

export interface BankAccount {
  id: string;
  iban?: string;
  name?: string;
  currency?: string;
  balance?: number;
  lastSyncAt?: string;
  importedCount?: number;
}

function bankingDir(): string {
  return path.join(getWorkspaceRoot(), "banking");
}

function configFile(): string {
  return path.join(getCompaniesRoot(), ".banking_config.json");
}

function connectionsFile(): string {
  return path.join(bankingDir(), "connections.json");
}

async function ensureBankingDir(): Promise<void> {
  await fs.mkdir(bankingDir(), { recursive: true });
}

export async function getConfig(): Promise<BankingConfig | null> {
  // Priorité 1 : variables d'environnement (mode hébergé — credentials de l'opérateur)
  const envId = process.env.GOCARDLESS_SECRET_ID?.trim();
  const envKey = process.env.GOCARDLESS_SECRET_KEY?.trim();
  if (envId && envKey) {
    return { secretId: envId, secretKey: envKey };
  }
  // Priorité 2 : fichier local (mode auto-hébergé — credentials de l'utilisateur)
  try {
    const raw = await fs.readFile(configFile(), "utf-8");
    return JSON.parse(raw) as BankingConfig;
  } catch {
    return null;
  }
}

/** Indique si les credentials viennent des variables d'environnement (mode hébergé) */
export function isConfiguredViaEnv(): boolean {
  return !!(process.env.GOCARDLESS_SECRET_ID?.trim() && process.env.GOCARDLESS_SECRET_KEY?.trim());
}

export async function saveConfig(config: BankingConfig): Promise<void> {
  await fs.mkdir(path.dirname(configFile()), { recursive: true });
  await fs.writeFile(configFile(), JSON.stringify(config, null, 2));
}

export async function getConnections(): Promise<BankConnection[]> {
  try {
    const raw = await fs.readFile(connectionsFile(), "utf-8");
    return JSON.parse(raw) as BankConnection[];
  } catch {
    return [];
  }
}

async function saveConnections(connections: BankConnection[]): Promise<void> {
  await ensureBankingDir();
  await fs.writeFile(connectionsFile(), JSON.stringify(connections, null, 2));
}

// ── Cache token en mémoire ────────────────────────────────────────────────────

let _tokenCache: { token: GCToken; fetchedAt: number } | null = null;

async function getAccessToken(config: BankingConfig): Promise<string> {
  const now = Date.now();
  if (_tokenCache && now < _tokenCache.fetchedAt + (_tokenCache.token.access_expires - 60) * 1000) {
    return _tokenCache.token.access;
  }

  const res = await fetch(`${GC_BASE}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret_id: config.secretId, secret_key: config.secretKey }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GoCardless auth failed: ${err}`);
  }

  const token = await res.json() as GCToken;
  _tokenCache = { token, fetchedAt: now };
  return token.access;
}

async function gcFetch<T>(path: string, config: BankingConfig, options?: RequestInit): Promise<T> {
  const token = await getAccessToken(config);
  const res = await fetch(`${GC_BASE}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GoCardless error ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

// ── API publique ───────────────────────────────────────────────────────────────

/** Liste les banques disponibles pour un pays (code ISO, ex: "FR") */
export async function getInstitutions(country: string, config: BankingConfig): Promise<GCInstitution[]> {
  return gcFetch<GCInstitution[]>(`/institutions/?country=${country.toUpperCase()}`, config);
}

/** Crée une connexion OAuth → renvoie l'URL de redirection vers la banque */
export async function createRequisition(
  institutionId: string,
  redirectUrl: string,
  config: BankingConfig
): Promise<{ requisitionId: string; link: string }> {
  // Accord d'accès sur 90 jours d'historique
  const agreement = await gcFetch<{ id: string }>("/agreements/enduser/", config, {
    method: "POST",
    body: JSON.stringify({
      institution_id: institutionId,
      max_historical_days: 90,
      access_valid_for_days: 30,
      access_scope: ["balances", "details", "transactions"],
    }),
  });

  const req = await gcFetch<GCRequisition>("/requisitions/", config, {
    method: "POST",
    body: JSON.stringify({
      redirect: redirectUrl,
      institution_id: institutionId,
      agreement: agreement.id,
      reference: `comptaos_${Date.now()}`,
      user_language: "FR",
    }),
  });

  return { requisitionId: req.id, link: req.link };
}

/** Finalise la connexion après le retour OAuth : récupère les comptes */
export async function finalizeConnection(
  requisitionId: string,
  institution: { id: string; name: string; logo: string },
  config: BankingConfig
): Promise<BankConnection> {
  const req = await gcFetch<GCRequisition>(`/requisitions/${requisitionId}/`, config);

  // Récupérer les détails de chaque compte
  const accounts: BankAccount[] = await Promise.all(
    req.accounts.map(async (accountId) => {
      try {
        const [details, balances] = await Promise.all([
          gcFetch<{ account: { iban?: string; name?: string; currency?: string } }>(
            `/accounts/${accountId}/details/`, config
          ),
          gcFetch<{ balances: { balanceAmount: { amount: string }; balanceType: string }[] }>(
            `/accounts/${accountId}/balances/`, config
          ),
        ]);

        const closingBalance = balances.balances.find(
          (b) => b.balanceType === "closingBooked" || b.balanceType === "interimAvailable"
        );

        return {
          id: accountId,
          iban: details.account.iban,
          name: details.account.name ?? details.account.iban ?? accountId,
          currency: details.account.currency ?? "EUR",
          balance: closingBalance ? parseFloat(closingBalance.balanceAmount.amount) : undefined,
        } as BankAccount;
      } catch {
        return { id: accountId } as BankAccount;
      }
    })
  );

  const connection: BankConnection = {
    requisitionId,
    institutionId: institution.id,
    institutionName: institution.name,
    institutionLogo: institution.logo,
    accounts,
    createdAt: new Date().toISOString(),
    status: req.status,
  };

  const connections = await getConnections();
  // Remplacer si déjà existant, sinon ajouter
  const idx = connections.findIndex((c) => c.requisitionId === requisitionId);
  if (idx >= 0) connections[idx] = connection;
  else connections.push(connection);

  await saveConnections(connections);
  return connection;
}

/** Supprime une connexion */
export async function deleteConnection(requisitionId: string, config: BankingConfig): Promise<void> {
  // Supprimer côté GoCardless
  try {
    await gcFetch(`/requisitions/${requisitionId}/`, config, { method: "DELETE" });
  } catch {
    // Ignorer si déjà supprimé
  }
  const connections = await getConnections();
  await saveConnections(connections.filter((c) => c.requisitionId !== requisitionId));
}

/** Synchronise les transactions d'un compte et les importe dans le workspace */
export async function syncAccountTransactions(
  accountId: string,
  config: BankingConfig
): Promise<{ imported: number; skipped: number }> {
  const { default: yaml } = await import("yaml");
  const txnModule = await import("./transactionService.js");

  const data = await gcFetch<{ transactions: { booked: GCTransaction[]; pending?: GCTransaction[] } }>(
    `/accounts/${accountId}/transactions/`,
    config
  );

  const existing = await txnModule.loadAllTransactions();
  const existingIds = new Set(existing.map((t: { id: string }) => t.id));

  let imported = 0;
  let skipped = 0;

  const txnDir = path.join(getWorkspaceRoot(), "transactions");
  await fs.mkdir(txnDir, { recursive: true });

  for (const raw of data.transactions.booked) {
    const gcId = raw.transactionId ?? `gc_${accountId}_${raw.bookingDate}_${raw.transactionAmount.amount}`;
    const id = `bank_${gcId}`.replace(/[^a-zA-Z0-9_-]/g, "_");

    if (existingIds.has(id)) { skipped++; continue; }

    const amount = parseFloat(raw.transactionAmount.amount);
    const label =
      raw.remittanceInformationUnstructured ??
      raw.creditorName ??
      raw.debtorName ??
      "Virement bancaire";

    const transaction = {
      id,
      date: raw.bookingDate ?? raw.valueDate ?? new Date().toISOString().slice(0, 10),
      label,
      amount_ht: amount,
      vat: 0,
      amount_ttc: amount,
      currency: raw.transactionAmount.currency,
      category: "misc",
      account: accountId,
      status: "pending",
      notes: `Importé via PSD2 (GoCardless) — ${label}`,
      tags: ["bank_import"],
    };

    const filename = `${transaction.date}_${id}.yaml`;
    await fs.writeFile(
      path.join(txnDir, filename),
      yaml.stringify(transaction)
    );
    imported++;
  }

  // Mettre à jour lastSyncAt dans les connexions
  const connections = await getConnections();
  for (const conn of connections) {
    const acc = conn.accounts.find((a) => a.id === accountId);
    if (acc) {
      acc.lastSyncAt = new Date().toISOString();
      acc.importedCount = (acc.importedCount ?? 0) + imported;
    }
  }
  await saveConnections(connections);

  // Invalider le cache transactions
  txnModule.invalidateTransactionCache();

  return { imported, skipped };
}
