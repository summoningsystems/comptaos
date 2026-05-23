import { useEffect, useState } from "react";
import { CategoryRule, TreasuryAlert, Category, AiConfig, AiConfigStatus, AiProvider } from "../../types";
import {
  fetchCategoryRules,
  saveCategoryRules,
  fetchTreasuryAlert,
  saveTreasuryAlert,
  fetchAiConfig,
  saveAiConfig,
} from "../../api/client";

const CATEGORIES: Category[] = [
  "hosting", "software", "salary", "travel", "restaurant", "food",
  "taxes", "equipment", "subscription", "rent", "legal", "insurance", "misc",
];

const CATEGORY_LABELS: Record<Category, string> = {
  hosting: "Hébergement",
  software: "Logiciel",
  salary: "Salaire",
  travel: "Transport",
  restaurant: "Restaurant",
  food: "Alimentaire",
  taxes: "Impôts/Taxes",
  equipment: "Matériel",
  subscription: "Abonnement",
  rent: "Loyer",
  legal: "Juridique",
  insurance: "Assurance",
  misc: "Divers",
};

export function SettingsView() {
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [alert, setAlert] = useState<TreasuryAlert>({ threshold: 5000, enabled: false });
  const [aiStatus, setAiStatus] = useState<AiConfigStatus>({ configured: false });
  const [aiForm, setAiForm] = useState<AiConfig>({ provider: "github-models", apiKey: "", model: "gpt-4o-mini" });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showMistralKey, setShowMistralKey] = useState(false);

  // Form pour nouvelle règle
  const [newPattern, setNewPattern] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("misc");

  useEffect(() => {
    Promise.all([fetchCategoryRules(), fetchTreasuryAlert(), fetchAiConfig()])
      .then(([r, a, ai]) => {
        setRules(r);
        setAlert(a);
        setAiStatus(ai);
        if (ai.configured && ai.provider) {
          setAiForm((f) => ({ ...f, provider: ai.provider!, model: ai.model ?? f.model, baseUrl: ai.baseUrl ?? undefined }));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveRules(updated: CategoryRule[]) {
    setRules(updated);
    await saveCategoryRules(updated);
    flashSaved();
  }

  async function handleAddRule() {
    if (!newPattern.trim()) return;
    const rule: CategoryRule = { id: crypto.randomUUID(), pattern: newPattern.trim(), category: newCategory };
    await handleSaveRules([...rules, rule]);
    setNewPattern("");
    setNewCategory("misc");
  }

  async function handleDeleteRule(id: string) {
    await handleSaveRules(rules.filter((r) => r.id !== id));
  }

  async function handleSaveAlert() {
    await saveTreasuryAlert(alert);
    flashSaved();
  }

  async function handleSaveAi() {
    await saveAiConfig(aiForm);
    const updated = await fetchAiConfig();
    setAiStatus(updated);
    flashSaved();
  }

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-vscode-muted text-sm">
        Chargement…
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8 text-vscode-text">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Paramètres</h1>
        {saved && (
          <span className="text-xs text-green-400 bg-green-900/30 px-3 py-1 rounded">
            ✓ Sauvegardé
          </span>
        )}
      </div>

      {/* ── Règles de catégorie ───────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-vscode-muted uppercase tracking-wider">
          Règles de catégorisation automatique
        </h2>
        <p className="text-xs text-vscode-muted">
          Si le libellé d'une transaction importée contient le motif (insensible à la casse), la
          catégorie indiquée est assignée en priorité.
        </p>

        {/* Table des règles */}
        {rules.length > 0 ? (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-vscode-muted border-b border-vscode-border">
                <th className="pb-2 pr-4 font-medium">Motif</th>
                <th className="pb-2 pr-4 font-medium">Catégorie</th>
                <th className="pb-2 font-medium w-16"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-vscode-border/50 hover:bg-vscode-panel/50">
                  <td className="py-2 pr-4">
                    <code className="bg-vscode-bg px-1.5 py-0.5 rounded text-xs text-yellow-300">
                      {rule.pattern}
                    </code>
                  </td>
                  <td className="py-2 pr-4 text-vscode-muted">
                    {CATEGORY_LABELS[rule.category]}
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-vscode-muted italic">Aucune règle définie.</p>
        )}

        {/* Formulaire d'ajout */}
        <div className="flex gap-2 items-center pt-1">
          <input
            type="text"
            value={newPattern}
            onChange={(e) => setNewPattern(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddRule()}
            placeholder="Motif (ex: AWS, Stripe, Loyer…)"
            className="flex-1 bg-vscode-bg border border-vscode-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-vscode-accent"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as Category)}
            className="bg-vscode-bg border border-vscode-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-vscode-accent"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <button
            onClick={handleAddRule}
            className="bg-vscode-accent hover:bg-blue-600 text-white text-sm px-3 py-1.5 rounded transition-colors"
          >
            Ajouter
          </button>
        </div>
      </section>

      {/* ── Alerte trésorerie ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-vscode-muted uppercase tracking-wider">
          Alerte trésorerie
        </h2>
        <p className="text-xs text-vscode-muted">
          Une bannière d'avertissement s'affiche dans la vue Frais récurrents si le solde prévu
          descend sous ce seuil.
        </p>

        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <div
              onClick={() => setAlert((a) => ({ ...a, enabled: !a.enabled }))}
              className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${
                alert.enabled ? "bg-vscode-accent" : "bg-vscode-border"
              } relative`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  alert.enabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </div>
            {alert.enabled ? "Activée" : "Désactivée"}
          </label>

          <div className="flex items-center gap-2">
            <span className="text-sm text-vscode-muted">Seuil :</span>
            <input
              type="number"
              min={0}
              step={100}
              value={alert.threshold}
              onChange={(e) => setAlert((a) => ({ ...a, threshold: parseFloat(e.target.value) || 0 }))}
              className="w-32 bg-vscode-bg border border-vscode-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-vscode-accent"
            />
            <span className="text-sm text-vscode-muted">€</span>
          </div>

          <button
            onClick={handleSaveAlert}
            className="bg-vscode-accent hover:bg-blue-600 text-white text-sm px-3 py-1.5 rounded transition-colors"
          >
            Sauvegarder
          </button>
        </div>
      </section>

      {/* ── Intelligence Artificielle ─────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-vscode-text">Intelligence Artificielle</h2>
          {aiStatus.configured && (
            <span className="text-xs bg-green-700/30 text-green-400 border border-green-700 px-2 py-0.5 rounded-full">
              Configuré · {aiStatus.provider} · {aiStatus.model}
            </span>
          )}
        </div>
        <p className="text-sm text-vscode-muted">
          Utilisé pour la catégorisation automatique des transactions et le copilote financier.
        </p>

        {aiStatus.configured && aiStatus.apiKeyPreview && (
          <p className="text-xs text-vscode-muted">
            Clé actuelle : <span className="font-mono text-vscode-text">{aiStatus.apiKeyPreview}</span>
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 max-w-xl">
          {/* Provider */}
          <div className="space-y-1">
            <label className="text-xs text-vscode-muted uppercase tracking-wide">Fournisseur</label>
            <select
              value={aiForm.provider}
              onChange={(e) => {
                const p = e.target.value as AiProvider;
                const defaults: Record<AiProvider, string> = {
                  anthropic: "claude-sonnet-4-5",
                  openai: "gpt-4o-mini",
                  "github-models": "gpt-4o-mini",
                  ollama: "llama3.2",
                };
                setAiForm((f) => ({ ...f, provider: p, model: defaults[p], baseUrl: p === "ollama" ? "http://localhost:11434" : undefined }));
              }}
              className="w-full bg-vscode-bg border border-vscode-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-vscode-accent"
            >
              <option value="github-models">GitHub Models (GitHub PAT)</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="ollama">Ollama (local)</option>
            </select>
          </div>

          {/* Modèle */}
          <div className="space-y-1">
            <label className="text-xs text-vscode-muted uppercase tracking-wide">Modèle</label>
            <input
              type="text"
              value={aiForm.model}
              onChange={(e) => setAiForm((f) => ({ ...f, model: e.target.value }))}
              placeholder="gpt-4o-mini"
              className="w-full bg-vscode-bg border border-vscode-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-vscode-accent"
            />
            <p className="text-xs text-vscode-muted">
              {aiForm.provider === "github-models" && "Ex : gpt-4o, gpt-4o-mini, Meta-Llama-3.1-70B-Instruct"}
              {aiForm.provider === "openai" && "Ex : gpt-4o, gpt-4o-mini, o1-mini"}
              {aiForm.provider === "anthropic" && "Ex : claude-sonnet-4-5, claude-3-5-haiku-20241022"}
              {aiForm.provider === "ollama" && "Ex : llama3.2, mistral, phi3"}
            </p>
          </div>

          {/* Clé API */}
          <div className="space-y-1">
            <label className="text-xs text-vscode-muted uppercase tracking-wide">Clé API</label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={aiForm.apiKey}
                onChange={(e) => setAiForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder={
                  aiForm.provider === "github-models" ? "github_pat_..." :
                  aiForm.provider === "openai" ? "sk-..." :
                  aiForm.provider === "anthropic" ? "sk-ant-..." :
                  "ollama (optionnel)"
                }
                className="w-full bg-vscode-bg border border-vscode-border rounded px-3 py-1.5 pr-10 text-sm focus:outline-none focus:border-vscode-accent font-mono"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-vscode-muted hover:text-vscode-text text-xs"
              >
                {showApiKey ? "Cacher" : "Voir"}
              </button>
            </div>
            <p className="text-xs text-vscode-muted">
              {aiForm.provider === "github-models" && "Personal Access Token GitHub (github_pat_… ou token classique avec accès Models)"}
              {aiForm.provider === "openai" && "Clé API OpenAI depuis platform.openai.com"}
              {aiForm.provider === "anthropic" && "Clé API Anthropic depuis console.anthropic.com"}
              {aiForm.provider === "ollama" && "Non requis — laisser vide ou mettre 'ollama'"}
            </p>
          </div>

          {/* URL de base (Ollama ou custom) */}
          {(aiForm.provider === "ollama" || aiForm.baseUrl) && (
            <div className="space-y-1">
              <label className="text-xs text-vscode-muted uppercase tracking-wide">URL de base (optionnel)</label>
              <input
                type="text"
                value={aiForm.baseUrl ?? ""}
                onChange={(e) => setAiForm((f) => ({ ...f, baseUrl: e.target.value || undefined }))}
                placeholder="http://localhost:11434"
                className="w-full bg-vscode-bg border border-vscode-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-vscode-accent"
              />
            </div>
          )}

          <button
            onClick={handleSaveAi}
            className="self-start bg-vscode-accent hover:bg-blue-600 text-white text-sm px-4 py-1.5 rounded transition-colors"
          >
            Enregistrer la configuration IA
          </button>
        </div>
      </section>

      {/* OCR Mistral */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-vscode-text border-b border-vscode-border pb-2">
          OCR Factures (Mistral)
        </h2>
        <p className="text-xs text-vscode-muted">
          L'OCR utilise l'API Mistral pour extraire le texte des PDF, puis votre fournisseur IA pour structurer les données.
          Obtenez une clé sur{" "}
          <a href="https://console.mistral.ai" target="_blank" rel="noreferrer" className="text-vscode-accent underline">
            console.mistral.ai
          </a>.
        </p>
        <div className="space-y-1">
          <label className="text-xs text-vscode-muted uppercase tracking-wide">Clé API Mistral (OCR)</label>
          <div className="relative">
            <input
              type={showMistralKey ? "text" : "password"}
              value={aiForm.mistralApiKey ?? ""}
              onChange={(e) => setAiForm((f) => ({ ...f, mistralApiKey: e.target.value || undefined }))}
              placeholder="..."
              className="w-full bg-vscode-bg border border-vscode-border rounded px-3 py-1.5 pr-10 text-sm focus:outline-none focus:border-vscode-accent font-mono"
            />
            <button
              type="button"
              onClick={() => setShowMistralKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-vscode-muted hover:text-vscode-text text-xs"
            >
              {showMistralKey ? "Cacher" : "Voir"}
            </button>
          </div>
        </div>
        <button
          onClick={handleSaveAi}
          className="self-start bg-vscode-accent hover:bg-blue-600 text-white text-sm px-4 py-1.5 rounded transition-colors"
        >
          Enregistrer
        </button>
      </section>
    </div>
  );
}
