import { useState } from "react";
import { acceptInvitation, fetchInvitationInfo, type AuthUser } from "../../api/auth";
import { useEffect } from "react";

interface Props {
  token: string;
  onAccepted: (user: AuthUser) => void;
}

export function AcceptInviteView({ token, onAccepted }: Props) {
  const [inviteInfo, setInviteInfo] = useState<{ role: string; email?: string } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchInvitationInfo(token)
      .then((info) => {
        setInviteInfo(info);
        if (info.email) setUsername(info.email.split("@")[0]);
      })
      .catch(() => setInviteError("Invitation invalide ou expirée."));
  }, [token]);

  const ROLE_LABELS: Record<string, string> = {
    admin: "Administrateur",
    member: "Membre",
    readonly: "Lecture seule",
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== password2) { setError("Les mots de passe ne correspondent pas."); return; }
    if (password.length < 8) { setError("Mot de passe trop court (min. 8 caractères)."); return; }
    setLoading(true);
    try {
      const user = await acceptInvitation(token, { username: username.trim(), displayName: displayName.trim(), password });
      // Retirer le param invite de l'URL sans recharger
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      window.history.replaceState({}, "", url.toString());
      onAccepted(user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création du compte.");
    } finally {
      setLoading(false);
    }
  }

  if (inviteError) {
    return (
      <div className="flex items-center justify-center h-screen bg-vscode-bg">
        <div className="text-center">
          <div className="text-4xl mb-4">🔗</div>
          <p className="text-red-400 text-sm">{inviteError}</p>
          <p className="text-vscode-muted text-xs mt-2">Contactez l'administrateur pour obtenir une nouvelle invitation.</p>
        </div>
      </div>
    );
  }

  if (!inviteInfo) {
    return (
      <div className="flex items-center justify-center h-screen bg-vscode-bg">
        <span className="text-vscode-muted text-sm">Vérification de l'invitation…</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-vscode-bg">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎉</div>
          <h1 className="text-2xl font-bold text-vscode-text">Invitation ComptaOS</h1>
          <p className="text-sm text-vscode-muted mt-2">
            Vous avez été invité en tant que{" "}
            <span className="font-semibold text-vscode-accent">
              {ROLE_LABELS[inviteInfo.role] ?? inviteInfo.role}
            </span>
          </p>
        </div>

        <div className="bg-vscode-sidebar border border-vscode-border rounded-xl p-8 shadow-xl">
          <h2 className="text-base font-semibold text-vscode-text mb-6">Créer votre compte</h2>
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
                placeholder="ex: marie"
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
              {loading ? "Création…" : "Créer mon compte"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
