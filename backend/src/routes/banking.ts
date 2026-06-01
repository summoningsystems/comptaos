import { FastifyInstance } from "fastify";
import {
  getConfig,
  saveConfig,
  getConnections,
  getConnectWebviewUrl,
  refreshConnections,
  deleteConnection,
  syncAccountTransactions,
  isConfiguredViaEnv,
  BankingConfig,
} from "../services/bankingService.js";

export async function bankingRoutes(app: FastifyInstance) {
  // â”€â”€ Configuration Powens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  app.get("/api/banking/config", async () => {
    const viaEnv = isConfiguredViaEnv();
    if (viaEnv) {
      return { configured: true, mode: "hosted" };
    }
    const config = await getConfig();
    if (!config) return { configured: false, mode: "self_hosted" };
    return { configured: true, mode: "self_hosted", domain: config.domain, clientId: config.clientId };
  });

  app.post("/api/banking/config", async (req, reply) => {
    if (isConfiguredViaEnv()) {
      return reply.status(403).send({ error: "Configuration gÃ©rÃ©e par l'opÃ©rateur" });
    }
    const { domain, clientId, clientSecret } = req.body as {
      domain?: string;
      clientId?: string;
      clientSecret?: string;
    };
    if (!domain || !clientId || !clientSecret) {
      return reply.status(400).send({ error: "domain, clientId et clientSecret requis" });
    }
    // RÃ©initialiser le userToken si les credentials changent
    await saveConfig({ domain: domain.trim(), clientId: clientId.trim(), clientSecret: clientSecret.trim() });
    return { ok: true };
  });

  // â”€â”€ Connexions existantes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  app.get("/api/banking/connections", async () => getConnections());

  // â”€â”€ DÃ©marrer une connexion via le webview Powens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  app.post("/api/banking/connect", async (req, reply) => {
    const config = await getConfig();
    if (!config) return reply.status(400).send({ error: "Powens non configurÃ©" });

    const { redirectUrl } = req.body as { redirectUrl?: string };
    if (!redirectUrl) {
      return reply.status(400).send({ error: "redirectUrl requis" });
    }

    try {
      const result = await getConnectWebviewUrl(redirectUrl, config);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur";
      return reply.status(502).send({ error: msg });
    }
  });

  // â”€â”€ RafraÃ®chir les connexions depuis l'API Powens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  app.post("/api/banking/refresh", async (req, reply) => {
    const config = await getConfig();
    if (!config) return reply.status(400).send({ error: "Powens non configurÃ©" });
    try {
      const connections = await refreshConnections(config);
      return connections;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur";
      return reply.status(502).send({ error: msg });
    }
  });

  // â”€â”€ Synchroniser tous les comptes d'une connexion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  app.post("/api/banking/sync-all/:connectionId", async (req, reply) => {
    const config = await getConfig();
    if (!config) return reply.status(400).send({ error: "Powens non configurÃ©" });

    const connectionId = parseInt((req.params as { connectionId: string }).connectionId, 10);
    const connections = await getConnections();
    const conn = connections.find((c) => c.connectionId === connectionId);
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

  // â”€â”€ Supprimer une connexion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  app.delete("/api/banking/connections/:connectionId", async (req, reply) => {
    const config = await getConfig();
    if (!config) return reply.status(400).send({ error: "Powens non configurÃ©" });

    const connectionId = parseInt((req.params as { connectionId: string }).connectionId, 10);
    try {
      await deleteConnection(connectionId, config);
      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur";
      return reply.status(502).send({ error: msg });
    }
  });
}


