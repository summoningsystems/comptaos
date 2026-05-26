import { FastifyInstance } from "fastify";
import {
  getConfig,
  saveConfig,
  getConnections,
  getInstitutions,
  createRequisition,
  finalizeConnection,
  deleteConnection,
  syncAccountTransactions,
  isConfiguredViaEnv,
  BankingConfig,
} from "../services/bankingService.js";

export async function bankingRoutes(app: FastifyInstance) {
  // ── Configuration API GoCardless ──────────────────────────────────────────

  app.get("/api/banking/config", async () => {
    const viaEnv = isConfiguredViaEnv();
    if (viaEnv) {
      // Credentials opérateur — ne rien exposer
      return { configured: true, mode: "hosted" };
    }
    const config = await getConfig();
    if (!config) return { configured: false, mode: "self_hosted" };
    return { configured: true, mode: "self_hosted", secretId: config.secretId };
  });

  // Enregistrer des credentials utilisateur (mode auto-hébergé uniquement)
  app.post("/api/banking/config", async (req, reply) => {
    if (isConfiguredViaEnv()) {
      return reply.status(403).send({ error: "Configuration gérée par l'opérateur" });
    }
    const { secretId, secretKey } = req.body as { secretId?: string; secretKey?: string };
    if (!secretId || !secretKey) {
      return reply.status(400).send({ error: "secretId et secretKey requis" });
    }
    await saveConfig({ secretId: secretId.trim(), secretKey: secretKey.trim() });
    return { ok: true };
  });

  // ── Banques disponibles ───────────────────────────────────────────────────

  app.get("/api/banking/institutions", async (req, reply) => {
    const config = await getConfig();
    if (!config) return reply.status(400).send({ error: "GoCardless non configuré" });

    const country = (req.query as { country?: string }).country ?? "FR";
    try {
      const list = await getInstitutions(country, config);
      return list;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur";
      return reply.status(502).send({ error: msg });
    }
  });

  // ── Connexions existantes ─────────────────────────────────────────────────

  app.get("/api/banking/connections", async () => getConnections());

  // ── Démarrer une connexion OAuth ──────────────────────────────────────────

  app.post("/api/banking/connect", async (req, reply) => {
    const config = await getConfig();
    if (!config) return reply.status(400).send({ error: "GoCardless non configuré" });

    const { institutionId, redirectUrl } = req.body as {
      institutionId?: string;
      redirectUrl?: string;
    };
    if (!institutionId || !redirectUrl) {
      return reply.status(400).send({ error: "institutionId et redirectUrl requis" });
    }

    try {
      const result = await createRequisition(institutionId, redirectUrl, config);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur";
      return reply.status(502).send({ error: msg });
    }
  });

  // ── Finaliser après le retour OAuth ──────────────────────────────────────

  app.post("/api/banking/finalize", async (req, reply) => {
    const config = await getConfig();
    if (!config) return reply.status(400).send({ error: "GoCardless non configuré" });

    const { requisitionId, institution } = req.body as {
      requisitionId?: string;
      institution?: { id: string; name: string; logo: string };
    };
    if (!requisitionId || !institution) {
      return reply.status(400).send({ error: "requisitionId et institution requis" });
    }

    try {
      return await finalizeConnection(requisitionId, institution, config);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur";
      return reply.status(502).send({ error: msg });
    }
  });

  // ── Synchroniser un compte ────────────────────────────────────────────────

  app.post("/api/banking/sync/:accountId", async (req, reply) => {
    const config = await getConfig();
    if (!config) return reply.status(400).send({ error: "GoCardless non configuré" });

    const { accountId } = req.params as { accountId: string };
    try {
      const result = await syncAccountTransactions(accountId, config);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur";
      return reply.status(502).send({ error: msg });
    }
  });

  // ── Synchroniser tous les comptes d'une connexion ─────────────────────────

  app.post("/api/banking/sync-all/:requisitionId", async (req, reply) => {
    const config = await getConfig();
    if (!config) return reply.status(400).send({ error: "GoCardless non configuré" });

    const { requisitionId } = req.params as { requisitionId: string };
    const connections = await getConnections();
    const conn = connections.find((c) => c.requisitionId === requisitionId);
    if (!conn) return reply.status(404).send({ error: "Connexion introuvable" });

    let totalImported = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    for (const acc of conn.accounts) {
      try {
        const r = await syncAccountTransactions(acc.id, config);
        totalImported += r.imported;
        totalSkipped += r.skipped;
      } catch (err: unknown) {
        errors.push(`${acc.name ?? acc.id}: ${err instanceof Error ? err.message : "Erreur"}`);
      }
    }

    return { imported: totalImported, skipped: totalSkipped, errors };
  });

  // ── Supprimer une connexion ───────────────────────────────────────────────

  app.delete("/api/banking/connections/:requisitionId", async (req, reply) => {
    const config = await getConfig();
    if (!config) return reply.status(400).send({ error: "GoCardless non configuré" });

    const { requisitionId } = req.params as { requisitionId: string };
    try {
      await deleteConnection(requisitionId, config);
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur";
      return reply.status(502).send({ error: msg });
    }
  });
}
