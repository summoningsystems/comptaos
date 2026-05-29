import { useState } from "react";
import { setupOwner, type AuthUser } from "../../api/auth";

interface Props {
  onSetup: (user: AuthUser) => void;
}

export function SetupView({ onSetup }: Props) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== password2) { setError("Les mots de passe ne correspondent pas."); return; }
    if (password.length < 8) { setError("Le mot de passe doit contenir au moins 8 caractères."); return; }
    if (!username.trim() || !displayName.trim()) { setError("Tous les champs sont requis."); return; }
    setLoading(true);
    try {
      const user = await setupOwner(username.trim(), displayName.trim(), password);
      onSetup(user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur";
      setError(msg.includes("409") || msg.includes("Setup déjà") ? "Un compte existe déjà." : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-vscode-bg">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">📊</div>
          <h1 className="text-2xl font-bold text-vscode-text">Bienvenue dans ComptaOS</h1>
          <p className="text-sm text-vscode-muted mt-2">
            Première installation — créez votre compte administrateur
          </p>
        </div>

        <div className="bg-vscode-sidebar border border-vscode-border rounded-xl p-8 shadow-xl">
          <h2 className="text-base font-semibold text-vscode-text mb-6">Créer le compte owner</h2>

          <form onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs text-vscode-muted mb-1">Nom affiché *</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Votre nom complet"
                className="w-full bg-vscode-bg border border-vscode-border text-vscode-text text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-vscode-accent"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-xs text-vscode-muted mb-1">Nom d'utilisateur *</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ex: admin"
                className="w-full bg-vscode-bg border border-vscode-border text-vscode-text text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-vscode-accent"
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-vscode-muted mb-1">Mot de passe * (min. 8 caractères)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe sécurisé"
                className="w-full bg-vscode-bg border border-vscode-border text-vscode-text text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-vscode-accent"
                autoComplete="new-password"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-vscode-muted mb-1">Confirmer le mot de passe *</label>
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="Répéter le mot de passe"
                className="w-full bg-vscode-bg border border-vscode-border text-vscode-text text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-vscode-accent"
                autoComplete="new-password"
                required
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-xs rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full bg-vscode-accent text-white text-sm font-semibold rounded-lg px-4 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Création en cours…" : "Créer le compte et commencer"}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-vscode-muted mt-4">
          Ce compte owner aura tous les droits d'administration.
        </p>
      </div>
    </div>
  );
}
