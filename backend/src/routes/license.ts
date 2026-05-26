import { FastifyInstance } from "fastify";
import {
  getLicense,
  activateLicense,
  deactivateLicense,
  PLANS,
} from "../services/licenseService.js";

export async function licenseRoutes(app: FastifyInstance) {
  // Licence courante
  app.get("/api/license", async () => getLicense());

  // Liste des plans disponibles
  app.get("/api/license/plans", async () => PLANS);

  // Activer une licence
  app.post("/api/license/activate", async (req, reply) => {
    const { key, email } = req.body as { key?: string; email?: string };
    if (!key || !email) {
      return reply.status(400).send({ error: "Clé et email requis" });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return reply.status(400).send({ error: "Email invalide" });
    }
    try {
      return await activateLicense(key.trim().toUpperCase(), email.trim());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      return reply.status(400).send({ error: msg });
    }
  });

  // Désactiver la licence (retour plan Gratuit)
  app.post("/api/license/deactivate", async () => {
    await deactivateLicense();
    return { ok: true };
  });
}
