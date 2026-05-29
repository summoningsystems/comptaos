import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import yaml from "yaml";
import { Transaction } from "../types/index.js";
import { getWorkspaceRoot, resolveSafe } from "./fileSystem.js";

const TXN_DIR = "transactions";

/** Retourne le chemin absolu du dossier transactions. */
function txnDir(): string {
  return path.join(getWorkspaceRoot(), TXN_DIR);
}

// ── Cache mémoire ─────────────────────────────────────────────────────────────
let _cache: Transaction[] | null = null;
let _watcher: fsSync.FSWatcher | null = null;

function invalidateCache() { _cache = null; }

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function deriveVatRate(txn: Transaction): number {
  if (typeof txn.vat_rate === "number" && Number.isFinite(txn.vat_rate)) {
    return Math.max(0, txn.vat_rate);
  }

  const ttcAbs = Math.abs(txn.amount_ttc ?? 0);
  const vatAbs = Math.abs(txn.vat ?? 0);
  const htAbs = Math.max(0, ttcAbs - vatAbs);
  if (htAbs <= 0) return 0;

  return round2((vatAbs / htAbs) * 100);
}

function normalizeTransaction(txn: Transaction): Transaction {
  const rate = deriveVatRate(txn);
  const factor = 1 + rate / 100;

  // Si le taux est renseigné, les montants HT/TVA sont recalculés pour rester cohérents.
  const amount_ht = factor > 0 ? round2((txn.amount_ttc ?? 0) / factor) : round2(txn.amount_ttc ?? 0);
  const vat = round2((txn.amount_ttc ?? 0) - amount_ht);

  return {
    ...txn,
    vat_rate: rate,
    amount_ht,
    vat,
  };
}

/**
 * À appeler lors d'un changement d'entreprise active pour forcer le rechargement
 * depuis le bon dossier et réinitialiser le watcher sur le bon répertoire.
 */
export function invalidateTransactionCache(): void {
  _cache = null;
  if (_watcher) {
    _watcher.close();
    _watcher = null;
  }
}

function ensureWatcher() {
  if (_watcher) return;
  const dir = txnDir();
  try {
    fsSync.mkdirSync(dir, { recursive: true });
    _watcher = fsSync.watch(dir, { persistent: false }, () => invalidateCache());
    _watcher.on("error", () => { _watcher = null; });
  } catch { /* ignore si le dossier n'existe pas encore */ }
}

/** Charge toutes les transactions depuis les fichiers YAML du dossier transactions/. */
export async function loadAllTransactions(): Promise<Transaction[]> {
  ensureWatcher();
  if (_cache) return _cache;

  const dir = txnDir();
  await fs.mkdir(dir, { recursive: true });

  const files = await fs.readdir(dir);
  const transactions: Transaction[] = [];

  for (const file of files) {
    if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;
    try {
      const content = await fs.readFile(path.join(dir, file), "utf-8");
      const parsed = yaml.parse(content) as Transaction;
      if (parsed?.id) transactions.push(normalizeTransaction(parsed));
    } catch {
      // fichier corrompu — on l'ignore silencieusement
    }
  }

  _cache = transactions.sort((a, b) => b.date.localeCompare(a.date));
  return _cache;
}

/** Sauvegarde une transaction dans un fichier YAML. */
export async function saveTransaction(txn: Transaction): Promise<void> {
  const dir = txnDir();
  await fs.mkdir(dir, { recursive: true });
  const normalized = normalizeTransaction(txn);
  const filePath = path.join(dir, `${normalized.id}.yaml`);
  await fs.writeFile(filePath, yaml.stringify(normalized), "utf-8");
  invalidateCache();
}

/** Sauvegarde un lot de transactions. */
export async function saveTransactions(txns: Transaction[]): Promise<void> {
  await Promise.all(txns.map(saveTransaction));
  // invalidateCache() déjà appelé dans saveTransaction
}

/** Met à jour une transaction existante. */
export async function updateTransaction(id: string, patch: Partial<Transaction>): Promise<Transaction> {
  const dir = txnDir();
  const filePath = path.join(dir, `${id}.yaml`);
  const content = await fs.readFile(filePath, "utf-8");
  const txn = yaml.parse(content) as Transaction;
  const updated = normalizeTransaction({ ...txn, ...patch });
  await fs.writeFile(filePath, yaml.stringify(updated), "utf-8");
  invalidateCache();
  return updated;
}

/** Supprime une transaction. */
export async function deleteTransaction(id: string): Promise<void> {
  const filePath = resolveSafe(`${TXN_DIR}/${id}.yaml`);
  await fs.unlink(filePath);
  invalidateCache();
}
