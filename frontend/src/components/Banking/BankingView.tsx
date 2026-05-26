import { useEffect, useState, useCallback } from "react";
import axios from "axios";

interface Institution {
  id: string;
  name: string;
  bic: string;
  logo: string;
  transaction_total_days: string;
}

interface BankAccount {
  id: string;
  iban?: string;
  name?: string;
  currency?: string;
  balance?: number;
  lastSyncAt?: string;
  importedCount?: number;
}

interface BankConnection {
  requisitionId: string;
  institutionId: string;
  institutionName: string;
  institutionLogo: string;
  accounts: BankAccount[];
  createdAt: string;
  status: string;
}

interface GCConfig {
  configured: boolean;
  mode?: "hosted" | "self_hosted";
  secretId?: string;
}

type Step = "connections" | "setup" | "select_bank" | "waiting_oauth";

export function BankingView() {
  const [gcConfig, setGcConfig] = useState<GCConfig>({ configured: false });
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionSearch, setInstitutionSearch] = useState("");
  const [step, setStep] = useState<Step>("connections");
  const [loading, setLoading] = useState(true);

  // Setup form
  const [secretId, setSecretId] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [setupMsg, setSetupMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);

  // OAuth en cours
  const [pendingRequisition, setPendingRequisition] = useState<{
    id: string;
    institution: Institution;
  } | null>(null);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);

  // Sync
  const [syncStatus, setSyncStatus] = useState<Record<string, { loading: boolean; msg: string }>>({});

  const loadData = useCallback(async () => {
    try {
      const [cfg, conns] = await Promise.all([
        axios.get<GCConfig>("/api/banking/config"),
        axios.get<BankConnection[]>("/api/banking/connections"),
      ]);
      setGcConfig(cfg.data);
      setConnections(conns.data);
    } catch {/* silent */}
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Détecter retour OAuth (?banking_ref=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("banking_ref");
    const instRaw = params.get("banking_inst");
    if (ref && instRaw && pendingRequisition) {
      // nettoyer l'URL
      window.history.replaceState({}, "", window.location.pathname);
      finalizeOAuth(ref, pendingRequisition.institution);
    }
  });

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setSetupLoading(true);
    setSetupMsg(null);
    try {
      await axios.post("/api/banking/config", { secretId, secretKey });
      setSetupMsg({ ok: true, text: "Credentials enregistrés !" });
      setGcConfig({ configured: true, secretId });
      setSecretKey("");
      setStep("connections");
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Erreur";
      setSetupMsg({ ok: false, text: msg ?? "Erreur" });
    } finally {
      setSetupLoading(false);
    }
  }

  async function loadInstitutions() {
    try {
      const { data } = await axios.get<Institution[]>("/api/banking/institutions?country=FR");
      setInstitutions(data);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Impossible de charger les banques";
      setConnectMsg(msg ?? "Erreur");
    }
    setStep("select_bank");
  }

  async function handleConnect(institution: Institution) {
    setConnectMsg(null);
    // L'URL de retour pointe vers l'app avec un paramètre custom
    const redirectUrl = `${window.location.origin}${window.location.pathname}?banking_ref=PENDING&banking_inst=${institution.id}`;
    try {
      const { data } = await axios.post<{ requisitionId: string; link: string }>("/api/banking/connect", {
        institutionId: institution.id,
        redirectUrl,
      });
      setPendingRequisition({ id: data.requisitionId, institution });
      setStep("waiting_oauth");
      // Ouvrir la page d'auth de la banque dans un popup
      window.open(data.link, "bank_auth", "popup,width=600,height=700");
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Erreur de connexion";
      setConnectMsg(msg ?? "Erreur");
    }
  }

  async function finalizeOAuth(requisitionId: string, institution: Institution) {
    setConnectMsg("Finalisation de la connexion…");
    try {
      await axios.post("/api/banking/finalize", {
        requisitionId,
        institution: { id: institution.id, name: institution.name, logo: institution.logo },
      });
      setPendingRequisition(null);
      setConnectMsg(null);
      setStep("connections");
      await loadData();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Erreur de finalisation";
      setConnectMsg(msg ?? "Erreur");
    }
  }

  async function handleFinalizeManual() {
    if (!pendingRequisition) return;
    await finalizeOAuth(pendingRequisition.id, pendingRequisition.institution);
  }

  async function handleSyncAll(conn: BankConnection) {
    setSyncStatus((s) => ({ ...s, [conn.requisitionId]: { loading: true, msg: "" } }));
    try {
      const { data } = await axios.post<{ imported: number; skipped: number; errors: string[] }>(
        `/api/banking/sync-all/${conn.requisitionId}`
      );
      const msg = `${data.imported} transaction(s) importée(s), ${data.skipped} déjà présente(s)${data.errors.length ? ` — ${data.errors.join(", ")}` : ""}`;
      setSyncStatus((s) => ({ ...s, [conn.requisitionId]: { loading: false, msg } }));
      await loadData();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Erreur de sync";
      setSyncStatus((s) => ({ ...s, [conn.requisitionId]: { loading: false, msg: msg ?? "Erreur" } }));
    }
  }

  async function handleDelete(conn: BankConnection) {
    if (!confirm(`Déconnecter ${conn.institutionName} ? Les transactions déjà importées seront conservées.`)) return;
    await axios.delete(`/api/banking/connections/${conn.requisitionId}`);
    await loadData();
  }

  const filteredInstitutions = institutions.filter((i) =>
    i.name.toLowerCase().includes(institutionSearch.toLowerCase()) ||
    i.bic?.toLowerCase().includes(institutionSearch.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center h-full text-vscode-muted text-sm">Chargement…</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-auto bg-vscode-bg text-vscode-text p-5">
      <div className="max-w-3xl mx-auto w-full flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold">🏦 Connexion bancaire PSD2</h1>
            <p className="text-xs text-vscode-muted mt-0.5">
              Importez automatiquement vos transactions depuis votre banque via Open Banking (GoCardless).
            </p>
          </div>
          <div className="flex gap-2">
            {gcConfig.configured && step === "connections" && (
              <>
                <button
                  onClick={loadInstitutions}
                  className="text-xs bg-vscode-accent text-white px-3 py-1.5 rounded hover:opacity-90"
                >
                  + Connecter une banque
                </button>
                {gcConfig.mode === "self_hosted" && (
                  <button
                    onClick={() => setStep("setup")}
                    className="text-xs border border-vscode-border text-vscode-muted px-3 py-1.5 rounded hover:text-vscode-text"
                    title="Modifier les credentials GoCardless"
                  >
                    ⚙️ API
                  </button>
                )}
              </>
            )}
            {step !== "connections" && (
              <button
                onClick={() => { setStep("connections"); setConnectMsg(null); }}
                className="text-xs border border-vscode-border text-vscode-muted px-3 py-1.5 rounded hover:text-vscode-text"
              >
                ← Retour
              </button>
            )}
          </div>
        </div>

        {/* ── Pas configuré côté serveur (mode hébergé sans env vars) ── */}
        {!gcConfig.configured && gcConfig.mode === "hosted" && step === "connections" && (
          <div className="bg-vscode-panel border border-yellow-700/40 rounded-lg p-5 text-center">
            <p className="text-2xl mb-2">🔧</p>
            <p className="text-sm font-bold mb-1">Connexion bancaire non activée</p>
            <p className="text-xs text-vscode-muted">
              Le service Open Banking n'est pas encore configuré sur ce serveur.
              Contactez le support pour l'activer sur votre compte Pro+.
            </p>
          </div>
        )}
        {(step === "setup" || (!gcConfig.configured && gcConfig.mode !== "hosted")) && (
          <div className="bg-vscode-panel border border-vscode-border rounded-lg p-5">
            {gcConfig.mode === "hosted" ? null : (
              <>
                <h2 className="text-sm font-bold mb-1">Configuration Open Banking</h2>
                <p className="text-xs text-vscode-muted mb-1">
                  Vous utilisez ComptaOS en mode auto-hébergé. Pour activer la connexion bancaire,
                  créez un compte gratuit sur{" "}
                  <a href="https://bankaccountdata.gocardless.com" target="_blank" rel="noopener noreferrer"
                    className="text-vscode-accent hover:underline">
                    GoCardless Bank Account Data
                  </a>{" "}
                  (50 connexions/mois gratuites) et collez vos credentials ci-dessous.
                </p>
                <p className="text-[10px] text-vscode-muted mb-4 italic">
                  En mode Pro+, cette configuration est gérée automatiquement — vous n'avez rien à faire.
                </p>
                <form onSubmit={handleSetup} className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs text-vscode-muted block mb-1">Secret ID</label>
                    <input
                      type="text"
                      value={secretId}
                      onChange={(e) => setSecretId(e.target.value)}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      required
                      className="w-full bg-vscode-bg border border-vscode-border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-vscode-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-vscode-muted block mb-1">Secret Key</label>
                    <input
                      type="password"
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      placeholder="••••••••••••••••••••••••••••••••••••••••"
                      required
                      className="w-full bg-vscode-bg border border-vscode-border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-vscode-accent"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={setupLoading}
                    className="self-start bg-vscode-accent text-white text-xs px-4 py-1.5 rounded hover:opacity-90 disabled:opacity-50"
                  >
                    {setupLoading ? "Enregistrement…" : "Enregistrer"}
                  </button>
                </form>
                {setupMsg && (
                  <p className={`mt-2 text-xs ${setupMsg.ok ? "text-green-400" : "text-red-400"}`}>
                    {setupMsg.text}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Étape : Sélection de la banque ── */}
        {step === "select_bank" && (
          <div className="bg-vscode-panel border border-vscode-border rounded-lg p-5">
            <h2 className="text-sm font-bold mb-3">Choisissez votre banque</h2>
            <input
              type="text"
              value={institutionSearch}
              onChange={(e) => setInstitutionSearch(e.target.value)}
              placeholder="Rechercher (BNP, Crédit Agricole, Boursorama…)"
              className="w-full bg-vscode-bg border border-vscode-border rounded px-3 py-1.5 text-xs mb-3 focus:outline-none focus:border-vscode-accent"
              autoFocus
            />
            {connectMsg && <p className="text-xs text-red-400 mb-2">{connectMsg}</p>}
            <div className="flex flex-col gap-1 max-h-80 overflow-auto">
              {filteredInstitutions.length === 0 && (
                <p className="text-xs text-vscode-muted py-4 text-center">
                  {institutions.length === 0 ? "Chargement…" : "Aucune banque trouvée"}
                </p>
              )}
              {filteredInstitutions.map((inst) => (
                <button
                  key={inst.id}
                  onClick={() => handleConnect(inst)}
                  className="flex items-center gap-3 px-3 py-2 rounded hover:bg-vscode-bg text-left transition-colors"
                >
                  {inst.logo ? (
                    <img src={inst.logo} alt={inst.name} className="w-6 h-6 object-contain rounded" />
                  ) : (
                    <span className="w-6 h-6 flex items-center justify-center text-sm">🏦</span>
                  )}
                  <div>
                    <p className="text-xs font-medium">{inst.name}</p>
                    {inst.bic && <p className="text-[10px] text-vscode-muted">{inst.bic}</p>}
                  </div>
                  <span className="ml-auto text-[10px] text-vscode-muted">
                    {inst.transaction_total_days}j d'historique
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Étape : Attente retour OAuth ── */}
        {step === "waiting_oauth" && pendingRequisition && (
          <div className="bg-vscode-panel border border-yellow-700/40 rounded-lg p-5 text-center">
            <p className="text-2xl mb-3">🔐</p>
            <h2 className="text-sm font-bold mb-2">
              Authentification {pendingRequisition.institution.name}
            </h2>
            <p className="text-xs text-vscode-muted mb-4">
              Une fenêtre s'est ouverte pour vous authentifier sur votre banque.
              Une fois terminé, revenez ici et cliquez sur le bouton ci-dessous.
            </p>
            {connectMsg && <p className="text-xs text-vscode-muted mb-3">{connectMsg}</p>}
            <div className="flex gap-2 justify-center">
              <button
                onClick={handleFinalizeManual}
                className="bg-vscode-accent text-white text-xs px-4 py-2 rounded hover:opacity-90"
              >
                ✓ J'ai terminé l'authentification
              </button>
              <button
                onClick={() => window.open(undefined, "bank_auth")?.focus()}
                className="border border-vscode-border text-xs px-3 py-2 rounded hover:bg-vscode-bg"
              >
                Rouvrir la fenêtre
              </button>
            </div>
          </div>
        )}

        {/* ── Liste des connexions existantes ── */}
        {step === "connections" && gcConfig.configured && (
          <>
            {connections.length === 0 ? (
              <div className="text-center py-12 text-vscode-muted">
                <p className="text-3xl mb-3">🏦</p>
                <p className="text-sm">Aucune banque connectée</p>
                <p className="text-xs mt-1">Cliquez sur "Connecter une banque" pour commencer.</p>
              </div>
            ) : (
              connections.map((conn) => (
                <div
                  key={conn.requisitionId}
                  className="bg-vscode-panel border border-vscode-border rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {conn.institutionLogo ? (
                        <img src={conn.institutionLogo} alt={conn.institutionName}
                          className="w-8 h-8 object-contain rounded" />
                      ) : (
                        <span className="text-xl">🏦</span>
                      )}
                      <div>
                        <p className="text-sm font-bold">{conn.institutionName}</p>
                        <p className="text-[10px] text-vscode-muted">
                          Connecté le {new Date(conn.createdAt).toLocaleDateString("fr-FR")}
                          {" · "}
                          <span className={conn.status === "LN" ? "text-green-400" : "text-yellow-400"}>
                            {conn.status === "LN" ? "✓ Actif" : conn.status}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSyncAll(conn)}
                        disabled={syncStatus[conn.requisitionId]?.loading}
                        className="text-xs bg-vscode-accent text-white px-3 py-1 rounded hover:opacity-90 disabled:opacity-50"
                      >
                        {syncStatus[conn.requisitionId]?.loading ? "Sync…" : "🔄 Synchroniser"}
                      </button>
                      <button
                        onClick={() => handleDelete(conn)}
                        className="text-xs border border-red-800/50 text-red-400 px-3 py-1 rounded hover:bg-red-900/20"
                      >
                        Déconnecter
                      </button>
                    </div>
                  </div>

                  {syncStatus[conn.requisitionId]?.msg && (
                    <p className="text-xs text-green-400 mb-2 px-1">
                      {syncStatus[conn.requisitionId].msg}
                    </p>
                  )}

                  {/* Comptes */}
                  <div className="flex flex-col gap-1.5">
                    {conn.accounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="flex items-center justify-between bg-vscode-bg rounded px-3 py-2 text-xs"
                      >
                        <div>
                          <span className="font-medium">{acc.name ?? acc.iban ?? acc.id}</span>
                          {acc.iban && acc.name && (
                            <span className="text-vscode-muted ml-2 font-mono">{acc.iban}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-vscode-muted">
                          {acc.balance !== undefined && (
                            <span className={acc.balance >= 0 ? "text-green-400 font-mono" : "text-red-400 font-mono"}>
                              {acc.balance.toLocaleString("fr-FR", { style: "currency", currency: acc.currency ?? "EUR" })}
                            </span>
                          )}
                          {acc.lastSyncAt && (
                            <span title={new Date(acc.lastSyncAt).toLocaleString("fr-FR")}>
                              Synchro {new Date(acc.lastSyncAt).toLocaleDateString("fr-FR")}
                              {acc.importedCount ? ` · ${acc.importedCount} tx` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* Note */}
        <p className="text-[10px] text-vscode-muted text-center mt-2">
          Connexion via Open Banking (PSD2). Vos identifiants bancaires
          ne transitent jamais par ComptaOS — l'authentification se fait directement sur le site de votre banque.
        </p>
      </div>
    </div>
  );
}
