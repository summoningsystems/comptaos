import { useState } from "react";
import { api } from "../../api/client";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => String(CURRENT_YEAR - i));
const MONTHS = [
  { value: "", label: "Année complète" },
  { value: "01", label: "Janvier" }, { value: "02", label: "Février" },
  { value: "03", label: "Mars" },    { value: "04", label: "Avril" },
  { value: "05", label: "Mai" },     { value: "06", label: "Juin" },
  { value: "07", label: "Juillet" }, { value: "08", label: "Août" },
  { value: "09", label: "Septembre" }, { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" }, { value: "12", label: "Décembre" },
];

export function ExportView() {
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [month, setMonth] = useState("");
  const [loading, setLoading] = useState<"xlsx" | "csv" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(format: "xlsx" | "csv") {
    setLoading(format);
    setError(null);
    try {
      const params: Record<string, string> = { year };
      if (month) params.month = month;

      const response = await api.get(`/export/${format}`, {
        params,
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const filename = month
        ? `compta_${year}_${month}.${format}`
        : `compta_${year}.${format}`;
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Erreur lors de la génération de l'export.");
    } finally {
      setLoading(null);
    }
  }

  const periodLabel = month
    ? `${MONTHS.find((m) => m.value === month)?.label} ${year}`
    : `Année ${year}`;

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-vscode-text mb-1">Export comptable</h1>
        <p className="text-xs text-vscode-muted">
          Génère un fichier Excel (.xlsx) ou CSV avec le grand livre, la balance par catégorie et le récapitulatif TVA.
        </p>
      </div>

      {/* Filtres */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-vscode-muted">Exercice</label>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="bg-vscode-panel border border-vscode-border text-vscode-text text-sm rounded px-2 py-1.5"
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-vscode-muted">Période</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-vscode-panel border border-vscode-border text-vscode-text text-sm rounded px-2 py-1.5"
          >
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {/* Cartes d'export */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Excel */}
        <div className="bg-vscode-panel border border-vscode-border rounded-lg p-5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📊</span>
            <div>
              <p className="text-sm font-medium text-vscode-text">Excel (.xlsx)</p>
              <p className="text-xs text-vscode-muted">Recommandé pour l'expert-comptable</p>
            </div>
          </div>
          <ul className="text-xs text-vscode-muted space-y-1 pl-1">
            <li>· Feuille Grand Livre (toutes les transactions)</li>
            <li>· Feuille Balance (totaux par catégorie)</li>
            <li>· Feuille TVA (collectée / déductible / nette)</li>
          </ul>
          <button
            onClick={() => download("xlsx")}
            disabled={loading !== null}
            className="mt-auto flex items-center justify-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm rounded transition-colors"
          >
            {loading === "xlsx" ? "⏳ Génération…" : "⬇ Télécharger Excel"}
          </button>
        </div>

        {/* CSV */}
        <div className="bg-vscode-panel border border-vscode-border rounded-lg p-5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📄</span>
            <div>
              <p className="text-sm font-medium text-vscode-text">CSV (.csv)</p>
              <p className="text-xs text-vscode-muted">Compatible Excel FR (séparateur point-virgule)</p>
            </div>
          </div>
          <ul className="text-xs text-vscode-muted space-y-1 pl-1">
            <li>· Grand Livre uniquement</li>
            <li>· Encodage UTF-8 avec BOM</li>
            <li>· Importable dans tout tableur</li>
          </ul>
          <button
            onClick={() => download("csv")}
            disabled={loading !== null}
            className="mt-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm rounded transition-colors"
          >
            {loading === "csv" ? "⏳ Génération…" : "⬇ Télécharger CSV"}
          </button>
        </div>
      </div>

      {/* Info période sélectionnée */}
      <p className="text-xs text-vscode-muted text-center">
        Export pour : <strong className="text-vscode-text">{periodLabel}</strong>
        {" "} — transactions validées et en attente (hors rejetées)
      </p>

      {error && (
        <p className="text-sm text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
