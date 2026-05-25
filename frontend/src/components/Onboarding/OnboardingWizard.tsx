import { useState } from "react";
import { createCompanyApi, setActiveCompanyApi, saveCompanyProfile } from "../../api/client";
import { GitSyncPanel } from "../Settings/GitSyncPanel";
import type { CompanyProfile } from "../../types";

interface Props {
  onDone: () => void;
  onCancel?: () => void;
}

type Step = 1 | 2 | 3;

const LEGAL_FORMS = [
  "Auto-entrepreneur / EI",
  "EURL",
  "SARL",
  "SAS",
  "SASU",
  "SA",
  "Autre",
];

export function OnboardingWizard({ onDone, onCancel }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [profile, setProfile] = useState<CompanyProfile>({ name: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function field(key: keyof CompanyProfile) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setProfile((p) => ({ ...p, [key]: e.target.value }));
  }

  async function handleCreateCompany() {
    if (!profile.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const company = await createCompanyApi(profile.name.trim());
      await setActiveCompanyApi(company.id);
      await saveCompanyProfile({ ...profile, onboardingDone: false });
      setStep(2);
    } catch {
      setError("Erreur lors de la création — vérifiez que le serveur est actif.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFinish() {
    await saveCompanyProfile({ ...profile, onboardingDone: true });
    onDone();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
         onClick={(e) => { if (onCancel && e.target === e.currentTarget) onCancel(); }}>
      <div className="relative w-full max-w-lg mx-4">
        {/* Bouton fermer (uniquement si l'annulation est possible) */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="absolute -top-10 right-0 text-white/60 hover:text-white text-sm transition-colors"
            title="Fermer"
          >
            ✕ Fermer
          </button>
        )}
        {/* Progression */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                ${step === s ? "bg-vscode-accent text-white scale-110" :
                  step > s ? "bg-green-500/20 text-green-400 border border-green-500" :
                  "bg-vscode-panel text-vscode-muted border border-vscode-border"}`}>
                {step > s ? "✓" : s}
              </div>
              {s < 3 && <div className={`w-16 h-px ${step > s ? "bg-green-500" : "bg-vscode-border"}`} />}
            </div>
          ))}
        </div>

        <div className="bg-vscode-sidebar border border-vscode-border rounded-2xl shadow-2xl overflow-hidden">

          {/* ── Étape 1 : Créer l'entreprise ─────────────────────────── */}
          {step === 1 && (
            <div className="p-8 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-vscode-text">Nouvelle entreprise</h2>
                <p className="text-xs text-vscode-muted mt-1">
                  Ces informations apparaîtront sur vos factures PDF et rapports.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs text-vscode-muted">Nom de l'entreprise *</label>
                  <input
                    autoFocus
                    type="text"
                    value={profile.name}
                    onChange={field("name")}
                    placeholder="Ma Société SAS"
                    onKeyDown={(e) => e.key === "Enter" && handleCreateCompany()}
                    className="w-full bg-vscode-bg border border-vscode-border rounded-lg px-3 py-2 text-sm text-vscode-text focus:outline-none focus:border-vscode-accent"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-vscode-muted">Forme juridique</label>
                  <select
                    value={profile.legalForm ?? ""}
                    onChange={field("legalForm")}
                    className="w-full bg-vscode-bg border border-vscode-border rounded-lg px-3 py-2 text-sm text-vscode-text focus:outline-none focus:border-vscode-accent"
                  >
                    <option value="">— Choisir —</option>
                    {LEGAL_FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-vscode-muted">SIREN</label>
                  <input type="text" value={profile.siren ?? ""} onChange={field("siren")} placeholder="123 456 789"
                    className="w-full bg-vscode-bg border border-vscode-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-vscode-accent" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-vscode-muted">N° TVA intracommunautaire</label>
                  <input type="text" value={profile.vatNumber ?? ""} onChange={field("vatNumber")} placeholder="FR 12 123456789"
                    className="w-full bg-vscode-bg border border-vscode-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-vscode-accent" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-vscode-muted">Email</label>
                  <input type="email" value={profile.email ?? ""} onChange={field("email")} placeholder="contact@masociete.fr"
                    className="w-full bg-vscode-bg border border-vscode-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-vscode-accent" />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-xs text-vscode-muted">Adresse</label>
                  <input type="text" value={profile.address ?? ""} onChange={field("address")} placeholder="12 rue de la Paix"
                    className="w-full bg-vscode-bg border border-vscode-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-vscode-accent" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-vscode-muted">Code postal</label>
                  <input type="text" value={profile.postalCode ?? ""} onChange={field("postalCode")} placeholder="75001"
                    className="w-full bg-vscode-bg border border-vscode-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-vscode-accent" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-vscode-muted">Ville</label>
                  <input type="text" value={profile.city ?? ""} onChange={field("city")} placeholder="Paris"
                    className="w-full bg-vscode-bg border border-vscode-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-vscode-accent" />
                </div>
              </div>

              {error && <p className="text-xs text-red-400 bg-red-500/10 rounded px-3 py-2">{error}</p>}

              <button
                onClick={handleCreateCompany}
                disabled={!profile.name.trim() || saving}
                className="w-full py-2.5 rounded-xl bg-vscode-accent hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
              >
                {saving ? "Création en cours…" : "Créer l'entreprise →"}
              </button>
            </div>
          )}

          {/* ── Étape 2 : Sauvegarde git ──────────────────────────────── */}
          {step === 2 && (
            <div className="p-8 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-vscode-text">Sauvegarde automatique</h2>
                <p className="text-xs text-vscode-muted mt-1">
                  Synchronisez vos données vers un dépôt privé. Modifiable à tout moment dans les Paramètres.
                </p>
              </div>

              <GitSyncPanel />

              <button
                onClick={() => setStep(3)}
                className="w-full py-2 rounded-xl bg-vscode-accent/80 hover:bg-vscode-accent text-white text-sm font-medium transition-colors"
              >
                Passer cette étape →
              </button>
            </div>
          )}

          {/* ── Étape 3 : Prêt ! ────────────────────────────────────── */}
          {step === 3 && (
            <div className="p-8 space-y-6 text-center">
              <div className="space-y-3">
                <div className="text-5xl">✅</div>
                <h2 className="text-xl font-bold text-vscode-text">
                  {profile.name} est prête !
                </h2>
                <p className="text-sm text-vscode-muted">
                  Votre entreprise a été créée. Commencez par importer vos transactions ou créer votre première facture.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                {[
                  { icon: "📥", label: "Importer des transactions", desc: "CSV, OFX, QIF" },
                  { icon: "🧾", label: "Créer une facture", desc: "PDF généré automatiquement" },
                  { icon: "📊", label: "Voir le dashboard", desc: "KPIs en temps réel" },
                  { icon: "⚙️", label: "Paramètres", desc: "IA, TVA, catégories…" },
                ].map((item) => (
                  <div key={item.icon} className="p-3 rounded-lg bg-vscode-bg border border-vscode-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{item.icon}</span>
                      <span className="text-xs font-medium text-vscode-text">{item.label}</span>
                    </div>
                    <p className="text-[10px] text-vscode-muted">{item.desc}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={handleFinish}
                className="w-full py-3 rounded-xl bg-vscode-accent hover:bg-blue-600 text-white text-sm font-bold transition-colors"
              >
                Accéder au dashboard →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
