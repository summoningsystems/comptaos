import axios from "axios";
import {
  FileNode,
  Transaction,
  DashboardData,
  CsvMappingConfig,
  ManualRecurring,
  CategoryRule,
  OutgoingInvoice,
  TreasuryAlert,
  AiConfig,
  AiConfigStatus,
  CategoryBudget,
  Company,
} from "../types";

export const api = axios.create({ baseURL: "/api" });

// Injecte automatiquement X-API-Key si configurée (stockée dans localStorage)
const _apiKey = localStorage.getItem("comptaos_api_key");
if (_apiKey) api.defaults.headers.common["X-API-Key"] = _apiKey;

// ── OCR ───────────────────────────────────────────────────────────────────────

export async function uploadInvoicePdf(file: File): Promise<{
  invoice: Partial<import("../types").Invoice>;
  rawText: string;
}> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await axios.post("/api/ocr/invoice", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// ── Files ────────────────────────────────────────────────────────────────────

export async function fetchFileTree(): Promise<FileNode[]> {
  const { data } = await api.get<FileNode[]>("/files");
  return data;
}

export async function fetchFileContent(path: string): Promise<string> {
  const { data } = await api.get<{ content: string }>("/files/content", {
    params: { path },
  });
  return data.content;
}

export async function saveFileContent(path: string, content: string): Promise<void> {
  await api.put("/files/content", { path, content });
}

export async function deleteFile(path: string): Promise<void> {
  await api.delete("/files", { params: { path } });
}

export async function createDirectory(path: string): Promise<void> {
  await api.post("/files/directory", { path });
}

export async function renameNode(oldPath: string, newPath: string): Promise<void> {
  await api.post("/files/rename", { oldPath, newPath });
}

// ── Transactions ──────────────────────────────────────────────────────────────

export async function fetchTransactions(): Promise<Transaction[]> {
  const { data } = await api.get<Transaction[]>("/transactions");
  return data;
}

export async function updateTransaction(id: string, patch: Partial<Transaction>): Promise<Transaction> {
  const { data } = await api.patch<Transaction>(`/transactions/${id}`, patch);
  return data;
}

export async function deleteTransaction(id: string): Promise<void> {
  await api.delete(`/transactions/${id}`);
}

export async function deleteTransactions(ids: string[]): Promise<void> {
  await api.delete("/transactions", { data: { ids } });
}

export async function bulkUpdateStatus(
  ids: string[],
  status: Transaction["status"]
): Promise<{ updated: number }> {
  const { data } = await api.patch<{ updated: number }>("/transactions/bulk-status", { ids, status });
  return data;
}

export async function createTransaction(txn: Omit<Transaction, "id">): Promise<Transaction> {
  const id = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const { data } = await api.post<Transaction>("/transactions", { id, ...txn });
  return data;
}

export async function uploadAttachment(
  txnId: string,
  file: File
): Promise<{ filename: string; transaction: Transaction }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await axios.post(`/api/attachments/upload/${txnId}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteAttachment(txnId: string, filename: string): Promise<Transaction> {
  const { data } = await api.delete<{ transaction: Transaction }>(`/attachments/${txnId}`, {
    data: { filename },
  });
  return data.transaction;
}

export function attachmentUrl(filename: string): string {
  return `/api/attachments/file/${encodeURIComponent(filename)}`;
}

// ── Import CSV ────────────────────────────────────────────────────────────────

export async function previewCsv(content: string): Promise<{
  columns: string[];
  samples: string[][];
}> {
  const { data } = await api.post("/import/preview", { content });
  return data;
}

export async function importCsv(
  content: string,
  mapping: CsvMappingConfig
): Promise<{ imported: number; skipped: number; transactions: Transaction[] }> {
  const { data } = await api.post("/import/csv", { content, mapping });
  return data;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function fetchDashboard(): Promise<DashboardData> {
  const { data } = await api.get<DashboardData>("/dashboard");
  return data;
}

// ── Frais récurrents manuels ──────────────────────────────────────────────────

export async function fetchManualRecurring(): Promise<ManualRecurring[]> {
  const { data } = await api.get<ManualRecurring[]>("/recurring/manual");
  return data;
}

export async function saveManualRecurring(entries: ManualRecurring[]): Promise<void> {
  await api.put("/recurring/manual", entries);
}

// ── Paramètres (règles + alerte) ──────────────────────────────────────────────────────

export async function fetchCategoryRules(): Promise<CategoryRule[]> {
  const { data } = await api.get<CategoryRule[]>("/settings/category-rules");
  return data;
}

export async function saveCategoryRules(rules: CategoryRule[]): Promise<void> {
  await api.put("/settings/category-rules", rules);
}

export async function fetchTreasuryAlert(): Promise<TreasuryAlert> {
  const { data } = await api.get<TreasuryAlert>("/settings/treasury-alert");
  return data;
}

export async function saveTreasuryAlert(alert: TreasuryAlert): Promise<void> {
  await api.put("/settings/treasury-alert", alert);
}

// ── Factures clients ───────────────────────────────────────────────────────────────────

export async function fetchInvoices(): Promise<OutgoingInvoice[]> {
  const { data } = await api.get<OutgoingInvoice[]>("/invoices/");
  return data;
}

export async function createInvoice(inv: Omit<OutgoingInvoice, "id"> & { id?: string }): Promise<OutgoingInvoice> {
  const { data } = await api.post<OutgoingInvoice>("/invoices/", inv);
  return data;
}

export async function updateInvoice(id: string, inv: OutgoingInvoice): Promise<OutgoingInvoice> {
  const { data } = await api.put<OutgoingInvoice>(`/invoices/${id}`, inv);
  return data;
}

export async function deleteInvoice(id: string): Promise<void> {
  await api.delete(`/invoices/${id}`);
}

// ── Configuration IA ─────────────────────────────────────────────────────

export async function fetchAiConfig(): Promise<AiConfigStatus> {
  const { data } = await api.get<AiConfigStatus>("/settings/ai");
  return data;
}

export async function saveAiConfig(config: AiConfig): Promise<void> {
  await api.put("/settings/ai", config);
}

// ── Budgets par catégorie ─────────────────────────────────────────────────────

export async function fetchBudgets(): Promise<CategoryBudget[]> {
  const { data } = await api.get<CategoryBudget[]>("/settings/budgets");
  return data;
}

export async function saveBudgets(budgets: CategoryBudget[]): Promise<void> {
  await api.put("/settings/budgets", budgets);
}

// ── Entreprises (multi-dossiers) ──────────────────────────────────────────────

export async function fetchCompanies(): Promise<Company[]> {
  const { data } = await api.get<Company[]>("/companies");
  return data;
}

export async function fetchActiveCompany(): Promise<Company | null> {
  const { data } = await api.get<Company | null>("/companies/active");
  return data;
}

export async function setActiveCompanyApi(companyId: string): Promise<void> {
  await api.put("/companies/active", { companyId });
}

export async function createCompanyApi(name: string): Promise<Company> {
  const { data } = await api.post<Company>("/companies", { name });
  return data;
}

// ── Smart catégorisation ───────────────────────────────────────────────────────

export interface SmartSuggestion {
  id: string;
  label: string;
  amount_ttc: number;
  suggestedCategory: string;
  confidenceLevel: "high" | "medium" | "low";
  confidenceScore: number;
  matchedKeyword: string;
}

export async function fetchSmartSuggestions(): Promise<{ suggestions: SmartSuggestion[]; learnedPatterns: number }> {
  const { data } = await api.get<{ suggestions: SmartSuggestion[]; learnedPatterns: number }>("/transactions/smart-categorize");
  return data;
}

export async function applySmartCategories(changes: { id: string; category: string }[]): Promise<{ updated: number }> {
  const { data } = await api.post<{ updated: number }>("/transactions/smart-categorize/apply", { changes });
  return data;
}

// ── Compte de résultat (P&L) ──────────────────────────────────────────────────

export interface PnlLine {
  account: string;
  label: string;
  amount: number;
  count: number;
}

export interface PnlData {
  year: string;
  produits: PnlLine[];
  charges: PnlLine[];
  total_produits: number;
  total_charges: number;
  resultat_brut: number;
  is_estimate: number;
  resultat_net: number;
}

export async function fetchPnl(year: string): Promise<PnlData> {
  const { data } = await api.get<PnlData>(`/reports/pnl?year=${year}`);
  return data;
}

// ── Git / Historique ──────────────────────────────────────────────────────────

export interface GitCommit {
  hash: string;
  shortHash: string;
  date: string;
  message: string;
  author: string;
  filesChanged: number;
}

export async function fetchGitLog(): Promise<{ commits: GitCommit[]; initialized: boolean }> {
  const { data } = await api.get<{ commits: GitCommit[]; initialized: boolean }>("/git/log");
  return data;
}

export async function fetchGitDiff(hash: string): Promise<string> {
  const { data } = await api.get<{ diff: string }>(`/git/diff/${hash}`);
  return data.diff;
}
