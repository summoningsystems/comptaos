import { useEffect, useState } from "react";
import {
  fetchUsers,
  fetchInvitations,
  createUser,
  updateUser,
  deleteUser,
  createInvitation,
  revokeInvitation,
  type AuthUser,
  type Invitation,
  type UserRole,
} from "../../api/auth";

const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Administrateur",
  member: "Membre",
  readonly: "Lecture seule",
};

const ROLE_COLORS: Record<UserRole, string> = {
  owner: "bg-purple-900/40 text-purple-300",
  admin: "bg-blue-900/40 text-blue-300",
  member: "bg-green-900/40 text-green-300",
  readonly: "bg-vscode-border text-vscode-muted",
};

interface Props {
  currentUser: AuthUser;
}

export function UsersView({ currentUser }: Props) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"users" | "invitations">("users");

  // Formulaire nouveau user direct
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Exclude<UserRole, "owner">>("member");
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  // Formulaire invitation
  const [showInvite, setShowInvite] = useState(false);
  const [inviteRole, setInviteRole] = useState<Exclude<UserRole, "owner">>("member");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<Invitation | null>(null);

  // Édition
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editRole, setEditRole] = useState<Exclude<UserRole, "owner">>("member");
  const [editActive, setEditActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);

  const canManage = currentUser.role === "owner" || currentUser.role === "admin";

  async function load() {
    setLoading(true);
    try {
      const [u, i] = await Promise.all([fetchUsers(), fetchInvitations()]);
      setUsers(u);
      setInvitations(i);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAddLoading(true);
    try {
      await createUser({ username: newUsername.trim(), displayName: newDisplayName.trim(), password: newPassword, role: newRole });
      setShowAddUser(false);
      setNewUsername(""); setNewDisplayName(""); setNewPassword("");
      await load();
    } catch (err) {
      setAddError((err as Error).message);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleSaveEdit(id: string) {
    setEditError(null);
    try {
      await updateUser(id, {
        displayName: editDisplayName,
        ...(currentUser.role === "owner" || currentUser.role === "admin" ? { role: editRole, active: editActive } : {}),
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setEditError((err as Error).message);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer l'utilisateur "${name}" ? Cette action est irréversible.`)) return;
    try {
      await deleteUser(id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteLoading(true);
    try {
      const inv = await createInvitation(inviteRole, inviteEmail || undefined);
      setCreatedInvite(inv);
      setInviteEmail(""); setShowInvite(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRevokeInvitation(token: string) {
    try {
      await revokeInvitation(token);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const inviteLink = createdInvite
    ? `${window.location.origin}${import.meta.env.BASE_URL}?invite=${createdInvite.token}`
    : null;

  const pendingInvitations = invitations.filter((i) => !i.usedAt && new Date(i.expiresAt) > new Date());

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-vscode-muted text-sm">
        Chargement…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-vscode-text">Gestion des utilisateurs</h2>
        {canManage && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddUser((v) => !v)}
              className="text-xs bg-vscode-accent text-white rounded px-3 py-1.5 hover:opacity-90"
            >
              + Ajouter un utilisateur
            </button>
            <button
              onClick={() => setShowInvite((v) => !v)}
              className="text-xs border border-vscode-border text-vscode-text rounded px-3 py-1.5 hover:bg-vscode-panel"
            >
              🔗 Créer une invitation
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-xs rounded px-3 py-2">
          {error}
          <button onClick={() => setError(null)} className="ml-2 hover:text-white">✕</button>
        </div>
      )}

      {/* Lien d'invitation créé */}
      {inviteLink && (
        <div className="bg-green-900/20 border border-green-700/40 rounded-lg p-4">
          <p className="text-xs text-green-300 font-semibold mb-2">🎉 Invitation créée — partagez ce lien :</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] text-vscode-text bg-vscode-bg rounded px-2 py-1 break-all">
              {inviteLink}
            </code>
            <button
              onClick={() => { void navigator.clipboard.writeText(inviteLink); }}
              className="text-xs border border-green-700/50 text-green-300 rounded px-2 py-1 hover:bg-green-900/40 shrink-0"
            >
              📋 Copier
            </button>
          </div>
          <p className="text-[10px] text-vscode-muted mt-2">Ce lien expire dans 7 jours.</p>
          <button onClick={() => setCreatedInvite(null)} className="text-[10px] text-vscode-muted hover:text-vscode-text mt-1 underline">
            Fermer
          </button>
        </div>
      )}

      {/* Formulaire ajout direct */}
      {showAddUser && canManage && (
        <div className="bg-vscode-sidebar border border-vscode-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-vscode-text mb-4">Ajouter un utilisateur</h3>
          <form onSubmit={(e) => { void handleAddUser(e); }} className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-vscode-muted mb-0.5">Nom affiché *</label>
              <input
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="w-full bg-vscode-bg border border-vscode-border text-vscode-text text-xs rounded px-2 py-1.5 focus:outline-none focus:border-vscode-accent"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-vscode-muted mb-0.5">Nom d'utilisateur *</label>
              <input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full bg-vscode-bg border border-vscode-border text-vscode-text text-xs rounded px-2 py-1.5 focus:outline-none focus:border-vscode-accent"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-vscode-muted mb-0.5">Mot de passe * (min. 8 car.)</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-vscode-bg border border-vscode-border text-vscode-text text-xs rounded px-2 py-1.5 focus:outline-none focus:border-vscode-accent"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-vscode-muted mb-0.5">Rôle *</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Exclude<UserRole, "owner">)}
                className="w-full bg-vscode-bg border border-vscode-border text-vscode-text text-xs rounded px-2 py-1.5 focus:outline-none focus:border-vscode-accent"
              >
                <option value="admin">Administrateur</option>
                <option value="member">Membre</option>
                <option value="readonly">Lecture seule</option>
              </select>
            </div>
            {addError && <div className="col-span-2 text-red-400 text-xs">{addError}</div>}
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAddUser(false)} className="text-xs text-vscode-muted hover:text-vscode-text px-3 py-1.5">
                Annuler
              </button>
              <button type="submit" disabled={addLoading} className="text-xs bg-vscode-accent text-white rounded px-3 py-1.5 hover:opacity-90 disabled:opacity-50">
                {addLoading ? "Création…" : "Créer l'utilisateur"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Formulaire invitation */}
      {showInvite && canManage && (
        <div className="bg-vscode-sidebar border border-vscode-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-vscode-text mb-4">Créer un lien d'invitation</h3>
          <form onSubmit={(e) => { void handleInvite(e); }} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-[10px] text-vscode-muted mb-0.5">Email (optionnel)</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="destinataire@email.com"
                className="w-full bg-vscode-bg border border-vscode-border text-vscode-text text-xs rounded px-2 py-1.5 focus:outline-none focus:border-vscode-accent"
              />
            </div>
            <div>
              <label className="block text-[10px] text-vscode-muted mb-0.5">Rôle</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Exclude<UserRole, "owner">)}
                className="bg-vscode-bg border border-vscode-border text-vscode-text text-xs rounded px-2 py-1.5 focus:outline-none focus:border-vscode-accent"
              >
                <option value="admin">Administrateur</option>
                <option value="member">Membre</option>
                <option value="readonly">Lecture seule</option>
              </select>
            </div>
            <button type="button" onClick={() => setShowInvite(false)} className="text-xs text-vscode-muted hover:text-vscode-text px-3 py-1.5">
              Annuler
            </button>
            <button type="submit" disabled={inviteLoading} className="text-xs bg-vscode-accent text-white rounded px-3 py-1.5 hover:opacity-90 disabled:opacity-50">
              {inviteLoading ? "…" : "Générer le lien"}
            </button>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-vscode-border">
        <button
          onClick={() => setTab("users")}
          className={`text-xs pb-2 px-1 border-b-2 -mb-px transition-colors ${tab === "users" ? "border-vscode-accent text-vscode-text font-semibold" : "border-transparent text-vscode-muted hover:text-vscode-text"}`}
        >
          Utilisateurs ({users.length})
        </button>
        {canManage && (
          <button
            onClick={() => setTab("invitations")}
            className={`text-xs pb-2 px-1 border-b-2 -mb-px transition-colors ${tab === "invitations" ? "border-vscode-accent text-vscode-text font-semibold" : "border-transparent text-vscode-muted hover:text-vscode-text"}`}
          >
            Invitations en cours ({pendingInvitations.length})
          </button>
        )}
      </div>

      {/* Liste utilisateurs */}
      {tab === "users" && (
        <div className="border border-vscode-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-vscode-panel">
              <tr>
                <th className="text-left px-4 py-2 text-vscode-muted">Utilisateur</th>
                <th className="text-left px-3 py-2 text-vscode-muted">Identifiant</th>
                <th className="text-left px-3 py-2 text-vscode-muted">Rôle</th>
                <th className="text-left px-3 py-2 text-vscode-muted">Statut</th>
                <th className="text-left px-3 py-2 text-vscode-muted">Dernière connexion</th>
                {canManage && <th className="text-right px-4 py-2 text-vscode-muted">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.id === currentUser.id;
                const isEditing = editingId === user.id;
                return (
                  <tr key={user.id} className={`border-t border-vscode-border ${!user.active ? "opacity-50" : ""}`}>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <input
                          value={editDisplayName}
                          onChange={(e) => setEditDisplayName(e.target.value)}
                          className="bg-vscode-bg border border-vscode-accent text-vscode-text text-xs rounded px-2 py-0.5 w-36 focus:outline-none"
                        />
                      ) : (
                        <span className="font-medium text-vscode-text">
                          {user.displayName}
                          {isSelf && <span className="ml-1 text-[10px] text-vscode-muted">(vous)</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-vscode-muted font-mono">{user.username}</td>
                    <td className="px-3 py-2">
                      {isEditing && canManage && user.role !== "owner" ? (
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as Exclude<UserRole, "owner">)}
                          className="bg-vscode-bg border border-vscode-border text-vscode-text text-xs rounded px-1 py-0.5 focus:outline-none"
                        >
                          <option value="admin">Administrateur</option>
                          <option value="member">Membre</option>
                          <option value="readonly">Lecture seule</option>
                        </select>
                      ) : (
                        <span className={`inline-flex rounded px-2 py-0.5 text-[10px] ${ROLE_COLORS[user.role]}`}>
                          {ROLE_LABELS[user.role]}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing && canManage && user.role !== "owner" ? (
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editActive}
                            onChange={(e) => setEditActive(e.target.checked)}
                            className="accent-vscode-accent"
                          />
                          <span className="text-[10px] text-vscode-muted">Actif</span>
                        </label>
                      ) : (
                        <span className={`text-[10px] ${user.active ? "text-green-400" : "text-red-400"}`}>
                          {user.active ? "Actif" : "Désactivé"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-vscode-muted font-mono">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    {canManage && (
                      <td className="px-4 py-2 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            {editError && <span className="text-red-400 text-[10px]">{editError}</span>}
                            <button
                              onClick={() => { void handleSaveEdit(user.id); }}
                              className="text-[10px] text-green-400 hover:text-green-300"
                            >
                              ✓ Enregistrer
                            </button>
                            <button
                              onClick={() => { setEditingId(null); setEditError(null); }}
                              className="text-[10px] text-vscode-muted hover:text-vscode-text"
                            >
                              ✕ Annuler
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingId(user.id);
                                setEditDisplayName(user.displayName);
                                setEditRole(user.role === "owner" ? "admin" : user.role);
                                setEditActive(user.active);
                                setEditError(null);
                              }}
                              className="text-[10px] text-vscode-muted hover:text-vscode-text"
                            >
                              ✏️ Modifier
                            </button>
                            {user.role !== "owner" && !isSelf && (
                              <button
                                onClick={() => { void handleDelete(user.id, user.displayName); }}
                                className="text-[10px] text-red-400 hover:text-red-300"
                              >
                                🗑 Supprimer
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Invitations en attente */}
      {tab === "invitations" && canManage && (
        <div className="border border-vscode-border rounded-lg overflow-hidden">
          {pendingInvitations.length === 0 ? (
            <div className="px-4 py-8 text-center text-vscode-muted text-xs">
              Aucune invitation en attente.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-vscode-panel">
                <tr>
                  <th className="text-left px-4 py-2 text-vscode-muted">Rôle</th>
                  <th className="text-left px-3 py-2 text-vscode-muted">Email</th>
                  <th className="text-left px-3 py-2 text-vscode-muted">Créée le</th>
                  <th className="text-left px-3 py-2 text-vscode-muted">Expire le</th>
                  <th className="text-right px-4 py-2 text-vscode-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvitations.map((inv) => (
                  <tr key={inv.token} className="border-t border-vscode-border">
                    <td className="px-4 py-2">
                      <span className={`inline-flex rounded px-2 py-0.5 text-[10px] ${ROLE_COLORS[inv.role]}`}>
                        {ROLE_LABELS[inv.role]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-vscode-muted">{inv.email ?? "—"}</td>
                    <td className="px-3 py-2 text-vscode-muted">{new Date(inv.createdAt).toLocaleDateString("fr-FR")}</td>
                    <td className="px-3 py-2 text-vscode-muted">{new Date(inv.expiresAt).toLocaleDateString("fr-FR")}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            const link = `${window.location.origin}${import.meta.env.BASE_URL}?invite=${inv.token}`;
                            void navigator.clipboard.writeText(link);
                          }}
                          className="text-[10px] text-vscode-muted hover:text-vscode-text"
                        >
                          📋 Copier lien
                        </button>
                        <button
                          onClick={() => { void handleRevokeInvitation(inv.token); }}
                          className="text-[10px] text-red-400 hover:text-red-300"
                        >
                          🗑 Révoquer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
