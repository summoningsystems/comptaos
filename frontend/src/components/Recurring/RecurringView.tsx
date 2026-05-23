import { useEffect, useMemo, useState } from "react";
import { fetchTransactions, fetchManualRecurring, saveManualRecurring, fetchTreasuryAlert } from "../../api/client";
import { Category, ManualRecurring, Transaction, TreasuryAlert } from "../../types";

// ── Types ────────────────────────────────────────────────────────────────────

type Frequency = "mensuel" | "trimestriel" | "annuel";

interface RecurringPattern {
  key: string;
  label: string;
  category: Category;
  avgAmount: number;
  frequency: Frequency;
  avgIntervalDays: number;
  lastDate: string;
  nextExpected: string;
  occurrences: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

// Détecte les patterns récurrents à partir d'un tableau de transactions
function detectRecurring(transactions: Transaction[]): RecurringPattern[] {
  // Grouper les dépenses par label normalisé
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.amount_ttc >= 0) continue; // dépenses uniquement
    const key = normalizeLabel(t.label);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const patterns: RecurringPattern[] = [];

  for (const [key, txns] of groups.entries()) {
    if (txns.length < 2) continue;

    const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));

    // Calculer les intervalles entre occurrences consécutives
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const diff =
        (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) /
        86_400_000;
      intervals.push(diff);
    }
    const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;

    // Classifier la fréquence
    let frequency: Frequency | null = null;
    if (avgInterval >= 20 && avgInterval <= 45) frequency = "mensuel";
    else if (avgInterval >= 80 && avgInterval <= 105) frequency = "trimestriel";
    else if (avgInterval >= 340 && avgInterval <= 400) frequency = "annuel";
    if (!frequency) continue;

    const avgAmount = sorted.reduce((s, t) => s + Math.abs(t.amount_ttc), 0) / sorted.length;
    const lastDate = sorted[sorted.length - 1].date;
    const nextExpected = addDays(lastDate, Math.round(avgInterval));

    patterns.push({
      key,
      label: sorted[sorted.length - 1].label,
      category: sorted[sorted.length - 1].category,
      avgAmount,
      frequency,
      avgIntervalDays: Math.round(avgInterval),
      lastDate,
      nextExpected,
      occurrences: sorted.length,
    });
  }

  return patterns.sort((a, b) => b.avgAmount - a.avgAmount);
}

// Projette les occurrences sur les N prochains mois
function buildForecast(patterns: RecurringPattern[], monthsAhead = 6): Map<string, RecurringPattern[]> {
  const today = new Date();
  const forecast = new Map<string, RecurringPattern[]>();

  // Initialiser les mois vides
  for (let i = 0; i < monthsAhead; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    forecast.set(key, []);
  }

  const startKey = monthKey(today.toISOString());
  const endKey = monthKey(
    new Date(today.getFullYear(), today.getMonth() + monthsAhead, 1).toISOString()
  );

  for (const p of patterns) {
    // Projeter en avançant par intervalles depuis nextExpected
    let cursor = p.nextExpected;
    let safety = 0;
    while (cursor < endKey + "-31" && safety < 50) {
      safety++;
      const m = monthKey(cursor);
      if (m >= startKey && m < endKey && forecast.has(m)) {
        forecast.get(m)!.push(p);
      }
      if (p.frequency === "mensuel") cursor = addDays(cursor, p.avgIntervalDays);
      else if (p.frequency === "trimestriel") cursor = addDays(cursor, p.avgIntervalDays);
      else break; // annuel : une seule occurrence
    }
  }

  return forecast;
}

// ── Component ────────────────────────────────────────────────────────────────

const FREQ_LABEL: Record<Frequency, string> = {
  mensuel: "Mensuel",
  trimestriel: "Trimestriel",
  annuel: "Annuel",
};

const FREQ_COLOR: Record<Frequency, string> = {
  mensuel: "bg-blue-900/40 text-blue-300 border-blue-800",
  trimestriel: "bg-purple-900/40 text-purple-300 border-purple-800",
  annuel: "bg-amber-900/40 text-amber-300 border-amber-800",
};

const CATEGORY_COLORS: Partial<Record<Category, string>> = {
  hosting: "bg-indigo-800 text-indigo-200",
  software: "bg-blue-800 text-blue-200",
  travel: "bg-green-800 text-green-200",
  subscription: "bg-purple-800 text-purple-200",
  rent: "bg-teal-800 text-teal-200",
  equipment: "bg-amber-800 text-amber-200",
  taxes: "bg-red-800 text-red-200",
  salary: "bg-teal-800 text-teal-200",
  restaurant: "bg-orange-800 text-orange-200",
  misc: "bg-gray-700 text-gray-300",
};

const CATEGORIES: Category[] = [
  "hosting", "software", "salary", "travel", "restaurant",
  "taxes", "equipment", "subscription", "rent", "misc",
];

/** Convertit une entrée manuelle en RecurringPattern pour le prévisionnel. */
function manualToPattern(m: ManualRecurring): RecurringPattern {
  const intervalDays = m.frequency === "mensuel" ? 30 : m.frequency === "trimestriel" ? 91 : 365;
  return {
    key: `manual_${m.id}`,
    label: m.label,
    category: m.category,
    avgAmount: m.amount,
    frequency: m.frequency,
    avgIntervalDays: intervalDays,
    lastDate: addDays(m.nextPayment, -intervalDays),
    nextExpected: m.nextPayment,
    occurrences: 0,
  };
}

export function RecurringView() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [manual, setManual] = useState<ManualRecurring[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<ManualRecurring>>({});
  const [forecastMonths, setForecastMonths] = useState<6 | 12>(6);
  const [treasuryAlert, setTreasuryAlert] = useState<TreasuryAlert>({ threshold: 5000, enabled: false });
  const [dismissed, setDismissed] = useState<Set<string>>(
    () => new Set<string>(JSON.parse(localStorage.getItem("compta_dismissed_patterns") ?? "[]"))
  );

  function dismissPattern(key: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(key);
      localStorage.setItem("compta_dismissed_patterns", JSON.stringify([...next]));
      return next;
    });
  }

  function restoreDismissed() {
    localStorage.removeItem("compta_dismissed_patterns");
    setDismissed(new Set());
  }

  useEffect(() => {
    Promise.all([fetchTransactions(), fetchManualRecurring(), fetchTreasuryAlert()]).then(([txns, man, alert]) => {
      setTransactions(txns);
      setManual(man);
      setTreasuryAlert(alert);
      setLoading(false);
    });
  }, []);

  const allPatterns = useMemo(() => detectRecurring(transactions), [transactions]);
  const patterns = useMemo(() => allPatterns.filter((p) => !dismissed.has(p.key)), [allPatterns, dismissed]);
  const monthlyPatterns = patterns.filter((p) => p.frequency === "mensuel");
  const otherPatterns = patterns.filter((p) => p.frequency !== "mensuel");

  const manualPatterns = useMemo(
    () => manual.filter((m) => m.active).map(manualToPattern),
    [manual]
  );
  const manualMonthlyCount = manualPatterns.filter((p) => p.frequency === "mensuel").length;

  const allPatternsForForecast = useMemo(
    () => [...patterns, ...manualPatterns],
    [patterns, manualPatterns]
  );

  const totalMonthly = useMemo(() => {
    const auto = monthlyPatterns.reduce((s, p) => s + p.avgAmount, 0);
    const man = manualPatterns.filter((p) => p.frequency === "mensuel").reduce((s, p) => s + p.avgAmount, 0);
    return auto + man;
  }, [monthlyPatterns, manualPatterns]);

  const currentBalance = useMemo(
    () => transactions.reduce((s, t) => s + t.amount_ttc, 0),
    [transactions]
  );

  const forecast = useMemo(() => buildForecast(allPatternsForForecast, forecastMonths), [allPatternsForForecast, forecastMonths]);

  const forecastWithBalance = useMemo(() => {
    let balance = currentBalance;
    return [...forecast.entries()].map(([monthStr, monthPatterns]) => {
      const expenses = monthPatterns.reduce((s, p) => s + p.avgAmount, 0);
      balance -= expenses;
      return { monthStr, monthPatterns, expenses, balanceAtEnd: balance };
    });
  }, [forecast, currentBalance]);

  async function doSaveManual(updated: ManualRecurring[]) {
    setManual(updated);
    await saveManualRecurring(updated);
  }

  function openAdd() {
    setEditingId("new");
    setForm({ label: "", category: "misc", amount: 0, frequency: "mensuel", nextPayment: new Date().toISOString().slice(0, 10), active: true });
  }

  function openEdit(m: ManualRecurring) {
    setEditingId(m.id);
    setForm({ ...m });
  }

  function closeForm() { setEditingId(null); setForm({}); }

  async function handleSave() {
    if (!form.label || !form.amount || !form.nextPayment) return;
    if (editingId === "new") {
      const entry: ManualRecurring = {
        id: `manual_${Date.now()}`,
        label: form.label!,
        category: form.category ?? "misc",
        amount: Number(form.amount),
        frequency: form.frequency ?? "mensuel",
        nextPayment: form.nextPayment!,
        active: true,
      };
      await doSaveManual([...manual, entry]);
    } else {
      await doSaveManual(manual.map((m) => (m.id === editingId ? ({ ...m, ...form } as ManualRecurring) : m)));
    }
    closeForm();
  }

  async function handleDelete(id: string) { await doSaveManual(manual.filter((m) => m.id !== id)); }
  async function handleToggle(id: string) { await doSaveManual(manual.map((m) => (m.id === id ? { ...m, active: !m.active } : m))); }

  if (loading) {
    return <div className="text-vscode-muted text-sm p-6">Analyse en cours…</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-6">
      <div className="flex items-baseline gap-4">
        <h2 className="text-vscode-text text-sm font-semibold">Frais récurrents</h2>
        <span className="text-vscode-muted text-xs">
          {patterns.length} auto · {manual.length} manuels · {transactions.filter((t) => t.amount_ttc < 0).length} dépenses
        </span>
      </div>

      {/* ── Résumé ─────────────────────────────────────────────────── */}
      <div className="bg-vscode-panel border border-vscode-border rounded-lg p-4 flex items-center gap-6 flex-wrap">
        <div>
          <div className="text-vscode-muted text-[10px] uppercase tracking-wide mb-0.5">Frais fixes / mois</div>
          <div className="text-2xl font-bold text-red-400">{totalMonthly.toFixed(2)} €</div>
        </div>
        <div className="h-8 w-px bg-vscode-border" />
        <div>
          <div className="text-vscode-muted text-[10px] uppercase tracking-wide mb-0.5">Postes mensuels</div>
          <div className="text-lg font-semibold text-vscode-text">{monthlyPatterns.length + manualMonthlyCount}</div>
        </div>
        <div className="h-8 w-px bg-vscode-border" />
        <div>
          <div className="text-vscode-muted text-[10px] uppercase tracking-wide mb-0.5">Frais annuels estimés</div>
          <div className="text-lg font-semibold text-vscode-text">{(totalMonthly * 12).toFixed(0)} €</div>
        </div>
        <div className="h-8 w-px bg-vscode-border" />
        <div>
          <div className="text-vscode-muted text-[10px] uppercase tracking-wide mb-0.5">Solde actuel estimé</div>
          <div className={`text-lg font-semibold ${currentBalance >= 0 ? "text-green-400" : "text-red-400"}`}>
            {currentBalance >= 0 ? "+" : ""}{currentBalance.toFixed(2)} €
          </div>
        </div>
      </div>

      {/* ── Frais manuels ──────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-vscode-muted uppercase tracking-wide">
            Frais manuels ({manual.length})
          </h3>
          <button
            onClick={openAdd}
            disabled={editingId !== null}
            className="text-[10px] px-2 py-0.5 rounded bg-vscode-accent text-white hover:bg-blue-600 disabled:opacity-40"
          >
            ＋ Ajouter
          </button>
        </div>

        {editingId !== null && (
          <div className="border border-vscode-accent rounded-lg p-3 mb-2 bg-blue-900/10 flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-vscode-muted">Libellé</label>
              <input
                className="bg-vscode-bg border border-vscode-border text-vscode-text text-xs px-2 py-1 rounded w-48 focus:outline-none focus:border-vscode-accent"
                value={form.label ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="ex: Loyer bureau"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-vscode-muted">Montant (€)</label>
              <input
                type="number"
                className="bg-vscode-bg border border-vscode-border text-vscode-text text-xs px-2 py-1 rounded w-24 focus:outline-none focus:border-vscode-accent"
                value={form.amount ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                min={0} step={0.01}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-vscode-muted">Catégorie</label>
              <select
                className="bg-vscode-bg border border-vscode-border text-vscode-text text-xs px-2 py-1 rounded focus:outline-none"
                value={form.category ?? "misc"}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-vscode-muted">Fréquence</label>
              <select
                className="bg-vscode-bg border border-vscode-border text-vscode-text text-xs px-2 py-1 rounded focus:outline-none"
                value={form.frequency ?? "mensuel"}
                onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as Frequency }))}
              >
                <option value="mensuel">Mensuel</option>
                <option value="trimestriel">Trimestriel</option>
                <option value="annuel">Annuel</option>
              </select>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-vscode-muted">Prochain paiement</label>
              <input
                type="date"
                className="bg-vscode-bg border border-vscode-border text-vscode-text text-xs px-2 py-1 rounded focus:outline-none focus:border-vscode-accent"
                value={form.nextPayment ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, nextPayment: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!form.label || !form.amount}
                className="text-[10px] px-3 py-1 rounded bg-vscode-accent text-white hover:bg-blue-600 disabled:opacity-40"
              >
                Enregistrer
              </button>
              <button
                onClick={closeForm}
                className="text-[10px] px-3 py-1 rounded border border-vscode-border text-vscode-muted hover:text-vscode-text"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {manual.length === 0 && editingId === null ? (
          <p className="text-[11px] text-vscode-muted italic">
            Aucun frais manuel. Cliquez sur « ＋ Ajouter » pour définir un loyer ou un abonnement non détecté automatiquement.
          </p>
        ) : manual.length > 0 && (
          <div className="border border-vscode-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-vscode-panel border-b border-vscode-border">
                <tr>
                  {["", "Libellé", "Catégorie", "Montant", "Fréquence", "Prochain", ""].map((h, i) => (
                    <th key={i} className="text-left px-3 py-2 text-vscode-muted font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {manual.map((m) => {
                  const isOverdue = m.nextPayment <= new Date().toISOString().slice(0, 10);
                  return (
                    <tr key={m.id} className={`border-b border-vscode-border last:border-0 hover:bg-vscode-panel/50 ${m.active ? "" : "opacity-40"}`}>
                      <td className="px-3 py-1.5 w-6">
                        <input type="checkbox" checked={m.active} onChange={() => handleToggle(m.id)} className="accent-vscode-accent" />
                      </td>
                      <td className="px-3 py-1.5 max-w-[200px] truncate" title={m.label}>{m.label}</td>
                      <td className="px-3 py-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[m.category] ?? "bg-gray-700 text-gray-300"}`}>{m.category}</span>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-red-400">{m.amount.toFixed(2)} €</td>
                      <td className="px-3 py-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${FREQ_COLOR[m.frequency]}`}>{FREQ_LABEL[m.frequency]}</span>
                      </td>
                      <td className={`px-3 py-1.5 ${isOverdue ? "text-yellow-400 font-medium" : "text-vscode-text"}`}>
                        {isOverdue ? "⚠ " : ""}{m.nextPayment}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(m)} disabled={editingId !== null} className="text-vscode-muted hover:text-vscode-text disabled:opacity-30">✏</button>
                          <button onClick={() => handleDelete(m.id)} disabled={editingId !== null} className="text-vscode-muted hover:text-red-400 disabled:opacity-30">✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Détection automatique ──────────────────────────────────── */}
      {patterns.length === 0 ? (
        <div className="text-center text-vscode-muted py-8 text-sm border border-vscode-border rounded-lg">
          Aucune récurrence détectée automatiquement.<br />
          <span className="text-[11px]">Il faut au moins 2 transactions avec le même libellé espacées de 20–400 jours.</span>
        </div>
      ) : (
        <>
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-vscode-muted uppercase tracking-wide">Auto-détectés mensuels ({monthlyPatterns.length})</h3>
              {dismissed.size > 0 && (
                <button onClick={restoreDismissed} className="text-[10px] text-vscode-muted hover:text-vscode-text">
                  Restaurer {dismissed.size} masqué{dismissed.size > 1 ? "s" : ""}
                </button>
              )}
            </div>
            <div className="border border-vscode-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-vscode-panel border-b border-vscode-border">
                  <tr>
                    {["Libellé", "Catégorie", "Moy. / occur.", "Fréquence", "Dernière", "Prochaine", "Occur.", ""].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-vscode-muted font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthlyPatterns.map((p) => {
                    const isOverdue = p.nextExpected <= new Date().toISOString().slice(0, 10);
                    return (
                      <tr key={p.key} className="border-b border-vscode-border hover:bg-vscode-panel last:border-0">
                        <td className="px-3 py-1.5 max-w-[220px] truncate" title={p.label}>{p.label}</td>
                        <td className="px-3 py-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[p.category] ?? "bg-gray-700 text-gray-300"}`}>{p.category}</span>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-red-400">{p.avgAmount.toFixed(2)} €</td>
                        <td className="px-3 py-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${FREQ_COLOR[p.frequency]}`}>{FREQ_LABEL[p.frequency]}</span>
                        </td>
                        <td className="px-3 py-1.5 text-vscode-muted">{p.lastDate}</td>
                        <td className={`px-3 py-1.5 ${isOverdue ? "text-yellow-400 font-medium" : "text-vscode-text"}`}>
                          {isOverdue ? "⚠ " : ""}{p.nextExpected}
                        </td>
                        <td className="px-3 py-1.5 text-vscode-muted">{p.occurrences}×</td>
                        <td className="px-3 py-1.5">
                          <button onClick={() => dismissPattern(p.key)} title="Retirer" className="text-vscode-muted hover:text-red-400 transition-colors">✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {otherPatterns.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-vscode-muted uppercase tracking-wide mb-2">Trimestriels / Annuels ({otherPatterns.length})</h3>
              <div className="border border-vscode-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-vscode-panel border-b border-vscode-border">
                    <tr>
                      {["Libellé", "Catégorie", "Moy. / occur.", "Fréquence", "Prochaine", "Occur.", ""].map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-vscode-muted font-normal">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {otherPatterns.map((p) => (
                      <tr key={p.key} className="border-b border-vscode-border hover:bg-vscode-panel last:border-0">
                        <td className="px-3 py-1.5 max-w-[220px] truncate" title={p.label}>{p.label}</td>
                        <td className="px-3 py-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[p.category] ?? "bg-gray-700 text-gray-300"}`}>{p.category}</span>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-red-400">{p.avgAmount.toFixed(2)} €</td>
                        <td className="px-3 py-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${FREQ_COLOR[p.frequency]}`}>{FREQ_LABEL[p.frequency]}</span>
                        </td>
                        <td className="px-3 py-1.5 text-vscode-text">{p.nextExpected}</td>
                        <td className="px-3 py-1.5 text-vscode-muted">{p.occurrences}×</td>
                        <td className="px-3 py-1.5">
                          <button onClick={() => dismissPattern(p.key)} title="Retirer" className="text-vscode-muted hover:text-red-400 transition-colors">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {/* ── Prévisionnel configurable ─────────────────────────── */}
      {allPatternsForForecast.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xs font-semibold text-vscode-muted uppercase tracking-wide">Prévisionnel</h3>
            <div className="flex gap-1">
              {([6, 12] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setForecastMonths(n)}
                  className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                    forecastMonths === n
                      ? "bg-vscode-accent text-white"
                      : "border border-vscode-border text-vscode-muted hover:text-vscode-text"
                  }`}
                >
                  {n} mois
                </button>
              ))}
            </div>
          </div>
          <div className={`grid gap-3 ${forecastMonths === 12 ? "grid-cols-4" : "grid-cols-3"}`}>
            {forecastWithBalance.map(({ monthStr, monthPatterns, expenses, balanceAtEnd }) => {
              const [year, mon] = monthStr.split("-");
              const isCurrentMonth = monthStr === new Date().toISOString().slice(0, 7);
              const balanceColor = balanceAtEnd >= 0 ? "text-green-400" : "text-red-400";
              return (
                <div key={monthStr} className={`border rounded-lg p-3 ${isCurrentMonth ? "border-vscode-accent bg-blue-900/10" : "border-vscode-border bg-vscode-panel"}`}>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs font-semibold text-vscode-text">
                      {MONTHS_FR[parseInt(mon, 10) - 1]} {year}
                      {isCurrentMonth && <span className="ml-1 text-[10px] text-vscode-accent">← now</span>}
                    </span>
                    <span className="text-xs font-mono text-red-400">{expenses > 0 ? `−${expenses.toFixed(0)} €` : "—"}</span>
                  </div>
                  {monthPatterns.length === 0 ? (
                    <div className="text-[10px] text-vscode-muted italic">Aucun frais prévu</div>
                  ) : (
                    <ul className="space-y-0.5">
                      {monthPatterns.map((p, i) => (
                        <li key={i} className="flex items-center justify-between text-[10px]">
                          <span className="text-vscode-muted truncate max-w-[130px]" title={p.label}>{p.label}</span>
                          <span className="text-red-400 font-mono shrink-0 ml-1">{p.avgAmount.toFixed(2)} €</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 pt-2 border-t border-vscode-border flex justify-between text-[10px]">
                    <span className="text-vscode-muted">Solde estimé</span>
                    <span className={`font-mono font-semibold ${balanceColor}`}>
                      {balanceAtEnd >= 0 ? "+" : ""}{balanceAtEnd.toFixed(0)} €
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
