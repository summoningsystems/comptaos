import { useEffect, useState } from "react";
import axios from "axios";

interface QuarterData {
  quarter: string;
  collected: number;
  deductible: number;
  net: number;
  revenue: number;
  expenses: number;
}

interface VatSummary {
  year: string;
  quarters: QuarterData[];
  total: { collected: number; deductible: number; net: number };
}

const API = axios.create({ baseURL: "http://localhost:3001/api" });

function Ca3Panel({ quarters, total, year }: { quarters: QuarterData[]; total: VatSummary["total"]; year: string }) {
  const [selectedQ, setSelectedQ] = useState<string>("annual");

  const activeData = selectedQ === "annual"
    ? { revenue: quarters.reduce((s, q) => s + q.revenue, 0), expenses: quarters.reduce((s, q) => s + q.expenses, 0), collected: total.collected, deductible: total.deductible, net: total.net }
    : (() => { const q = quarters.find(q => q.quarter === selectedQ); return q ? { revenue: q.revenue, expenses: q.expenses, collected: q.collected, deductible: q.deductible, net: q.net } : null; })();

  if (!activeData) return null;

  const baseHT = activeData.revenue > 0 ? activeData.revenue - activeData.collected : 0;
  const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function copyToClipboard() {
    const text = [
      `SIMULATION CA3 — ${selectedQ === "annual" ? `Annuel ${year}` : `${selectedQ} ${year}`}`,
      ``,
      `A  — Base HT (ventes 20%) :          ${fmt(baseHT)} €`,
      `08 — TVA collectée :                 ${fmt(activeData.collected)} €`,
      `20 — TVA déductible (achats) :       ${fmt(activeData.deductible)} €`,
      `28 — Total taxe due (ligne 08) :     ${fmt(activeData.collected)} €`,
      `29 — Total taxe déductible :         ${fmt(activeData.deductible)} €`,
      `52 — TVA à payer (28 - 29) :         ${fmt(activeData.net)} €`,
    ].join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
  }

  const Ca3Row = ({ code, label, value, bold, color }: { code: string; label: string; value: number; bold?: boolean; color?: string }) => (
    <div className={`flex items-center gap-2 px-4 py-2 border-b border-vscode-border/40 ${bold ? "bg-vscode-panel/50" : ""}`}>
      <span className="font-mono text-[10px] text-vscode-muted w-6 shrink-0">{code}</span>
      <span className={`flex-1 text-xs ${bold ? "font-semibold text-vscode-text" : "text-vscode-muted"}`}>{label}</span>
      <span className={`font-mono tabular-nums text-xs w-32 text-right ${color ?? "text-vscode-text"} ${bold ? "font-bold" : ""}`}>
        {fmt(value)} €
      </span>
    </div>
  );

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-vscode-muted uppercase tracking-wide">Simulation CA3</h3>
        <div className="flex items-center gap-2">
          <select
            value={selectedQ}
            onChange={(e) => setSelectedQ(e.target.value)}
            className="bg-vscode-bg border border-vscode-border text-vscode-text text-xs rounded px-2 py-1 focus:outline-none focus:border-vscode-accent"
          >
            <option value="annual">Annuel {year}</option>
            {quarters.map((q) => <option key={q.quarter} value={q.quarter}>{q.quarter} {year}</option>)}
          </select>
          <button
            onClick={copyToClipboard}
            className="text-xs text-vscode-muted hover:text-vscode-text border border-vscode-border rounded px-2 py-1 flex items-center gap-1"
          >
            📋 Copier
          </button>
        </div>
      </div>

      <div className="border border-vscode-border rounded overflow-hidden text-xs">
        <div className="bg-vscode-panel px-4 py-2 text-[10px] font-semibold text-blue-400 uppercase tracking-widest">
          OPÉRATIONS IMPOSABLES — {selectedQ === "annual" ? `Année ${year}` : `${selectedQ} ${year}`}
        </div>
        <Ca3Row code="A" label="Base HT des opérations imposables à 20 %" value={baseHT} />
        <Ca3Row code="08" label="Taxe due à 20 %" value={activeData.collected} color="text-blue-300" bold />

        <div className="bg-vscode-panel px-4 py-2 text-[10px] font-semibold text-green-400 uppercase tracking-widest border-t border-vscode-border">
          TVA DÉDUCTIBLE
        </div>
        <Ca3Row code="20" label="TVA déductible sur autres biens et services" value={activeData.deductible} color="text-green-300" />

        <div className="bg-vscode-panel px-4 py-2 text-[10px] font-semibold text-orange-400 uppercase tracking-widest border-t border-vscode-border">
          RÉSULTAT
        </div>
        <Ca3Row code="28" label="Total taxe due" value={activeData.collected} />
        <Ca3Row code="29" label="Total taxe déductible" value={activeData.deductible} />

        <div className={`flex items-center gap-2 px-4 py-3 border-t-2 ${activeData.net > 0 ? "border-orange-600 bg-orange-900/20" : "border-green-600 bg-green-900/20"}`}>
          <span className="font-mono text-[10px] text-vscode-muted w-6 shrink-0">52</span>
          <span className="flex-1 font-bold text-vscode-text text-xs">
            {activeData.net > 0 ? "TVA à payer (ligne 28 − 29)" : "Crédit de TVA"}
          </span>
          <span className={`font-mono tabular-nums font-bold text-base w-32 text-right ${activeData.net > 0 ? "text-orange-300" : "text-green-300"}`}>
            {fmt(Math.abs(activeData.net))} €
          </span>
        </div>
      </div>

      <p className="text-[10px] text-vscode-muted mt-2">
        ⚠ Simulation à titre indicatif. Vérifiez avec votre expert-comptable avant dépôt sur impots.gouv.fr.
      </p>
    </div>
  );
}

export function VatView() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [data, setData] = useState<VatSummary | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(y: string) {
    setLoading(true);
    try {
      const { data: d } = await API.get<VatSummary>(`/reports/vat-summary?year=${y}`);
      setData(d);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(year); }, [year]);

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <h2 className="text-vscode-text text-base font-semibold">Déclaration TVA</h2>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="bg-vscode-bg border border-vscode-border text-vscode-text text-xs rounded px-2 py-1 focus:outline-none focus:border-vscode-accent"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {loading && <span className="text-vscode-muted text-xs">Calcul…</span>}
      </div>

      {data && (
        <>
          {/* Résumé annuel */}
          <div className="grid grid-cols-3 gap-4 max-w-2xl">
            <div className="bg-vscode-sidebar border border-vscode-border rounded-lg p-4">
              <p className="text-[11px] text-vscode-muted uppercase tracking-wide mb-1">TVA collectée</p>
              <p className="text-xl font-mono font-semibold text-blue-300">+{data.total.collected.toFixed(2)} €</p>
              <p className="text-[10px] text-vscode-muted mt-1">sur revenus encaissés</p>
            </div>
            <div className="bg-vscode-sidebar border border-vscode-border rounded-lg p-4">
              <p className="text-[11px] text-vscode-muted uppercase tracking-wide mb-1">TVA déductible</p>
              <p className="text-xl font-mono font-semibold text-green-300">−{data.total.deductible.toFixed(2)} €</p>
              <p className="text-[10px] text-vscode-muted mt-1">sur dépenses pro</p>
            </div>
            <div className={`bg-vscode-sidebar border rounded-lg p-4 ${data.total.net > 0 ? "border-orange-700" : "border-vscode-border"}`}>
              <p className="text-[11px] text-vscode-muted uppercase tracking-wide mb-1">TVA nette à reverser</p>
              <p className={`text-xl font-mono font-semibold ${data.total.net > 0 ? "text-orange-300" : "text-green-300"}`}>
                {data.total.net >= 0 ? "+" : ""}{data.total.net.toFixed(2)} €
              </p>
              <p className="text-[10px] text-vscode-muted mt-1">
                {data.total.net > 0 ? "À payer à la DGFiP" : "Crédit de TVA"}
              </p>
            </div>
          </div>

          {/* Note d'avertissement */}
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded px-3 py-2 text-[11px] text-yellow-300/80 max-w-2xl">
            ⚠ Ces montants sont calculés sur la base des taux TVA saisis lors de l'import. Vérifiez avec votre expert-comptable avant soumission.
          </div>

          {/* Tableau par trimestre */}
          <div className="max-w-3xl">
            <h3 className="text-xs font-semibold text-vscode-muted uppercase tracking-wide mb-3">Détail par trimestre — {year}</h3>            <table className="w-full text-xs border border-vscode-border rounded overflow-hidden">
              <thead className="bg-vscode-panel">
                <tr>
                  <th className="text-left px-4 py-2 text-vscode-muted">Trimestre</th>
                  <th className="text-right px-3 py-2 text-vscode-muted">CA HT</th>
                  <th className="text-right px-3 py-2 text-vscode-muted">Dépenses HT</th>
                  <th className="text-right px-3 py-2 text-blue-400/70">TVA collectée</th>
                  <th className="text-right px-3 py-2 text-green-400/70">TVA déductible</th>
                  <th className="text-right px-4 py-2 text-orange-400/70">Net à reverser</th>
                </tr>
              </thead>
              <tbody>
                {data.quarters.map((q) => {
                  const isEmpty = q.collected === 0 && q.deductible === 0;
                  return (
                    <tr key={q.quarter} className={`border-t border-vscode-border ${isEmpty ? "opacity-40" : ""}`}>
                      <td className="px-4 py-2 font-semibold text-vscode-text">{q.quarter} {year}</td>
                      <td className="text-right px-3 py-2 text-green-400 tabular-nums">
                        {q.revenue > 0 ? `+${q.revenue.toFixed(2)} €` : "—"}
                      </td>
                      <td className="text-right px-3 py-2 text-red-400 tabular-nums">
                        {q.expenses > 0 ? `−${q.expenses.toFixed(2)} €` : "—"}
                      </td>
                      <td className="text-right px-3 py-2 text-blue-300 tabular-nums font-mono">
                        {q.collected > 0 ? `${q.collected.toFixed(2)} €` : "0.00 €"}
                      </td>
                      <td className="text-right px-3 py-2 text-green-300 tabular-nums font-mono">
                        {q.deductible > 0 ? `${q.deductible.toFixed(2)} €` : "0.00 €"}
                      </td>
                      <td className={`text-right px-4 py-2 font-mono font-semibold tabular-nums ${q.net > 0 ? "text-orange-300" : q.net < 0 ? "text-green-300" : "text-vscode-muted"}`}>
                        {q.net > 0 ? `+${q.net.toFixed(2)} €` : q.net < 0 ? `${q.net.toFixed(2)} €` : "—"}
                      </td>
                    </tr>
                  );
                })}
                {/* Total */}
                <tr className="border-t-2 border-vscode-accent bg-vscode-panel">
                  <td className="px-4 py-2 font-bold text-vscode-text">TOTAL {year}</td>
                  <td colSpan={2} />
                  <td className="text-right px-3 py-2 text-blue-300 font-mono font-bold tabular-nums">
                    {data.total.collected.toFixed(2)} €
                  </td>
                  <td className="text-right px-3 py-2 text-green-300 font-mono font-bold tabular-nums">
                    {data.total.deductible.toFixed(2)} €
                  </td>
                  <td className={`text-right px-4 py-2 font-mono font-bold tabular-nums ${data.total.net > 0 ? "text-orange-300" : "text-green-300"}`}>
                    {data.total.net >= 0 ? "+" : ""}{data.total.net.toFixed(2)} €
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Simulateur CA3 */}
          <Ca3Panel quarters={data.quarters} total={data.total} year={year} />
        </>
      )}
    </div>
  );
}
