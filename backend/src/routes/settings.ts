import { FastifyInstance } from "fastify";
import {
  loadCategoryRules,
  saveCategoryRules,
  loadTreasuryAlert,
  saveTreasuryAlert,
  loadAiConfig,
  saveAiConfig,
  loadBudgets,
  saveBudgets,
  CategoryRule,
  TreasuryAlert,
  AiConfig,
  CategoryBudget,
} from "../services/settingsService.js";

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/category-rules", async (_req, reply) => {
    return reply.send(loadCategoryRules());
  });

  app.put<{ Body: CategoryRule[] }>("/category-rules", async (req, reply) => {
    saveCategoryRules(req.body);
    return reply.send({ ok: true });
  });

  app.get("/treasury-alert", async (_req, reply) => {
    return reply.send(loadTreasuryAlert());
  });

  app.put<{ Body: TreasuryAlert }>("/treasury-alert", async (req, reply) => {
    saveTreasuryAlert(req.body);
    return reply.send({ ok: true });
  });

  // GET /api/settings/ai — retourne la config IA (clé masquée)
  app.get("/ai", async (_req, reply) => {
    const config = loadAiConfig();
    if (!config) return reply.send({ configured: false });
    return reply.send({
      configured: true,
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl ?? null,
      // Masquer la clé : affiche les 4 premiers + "…"
      apiKeyPreview: config.apiKey.length > 4
        ? config.apiKey.slice(0, 4) + "…" + config.apiKey.slice(-3)
        : "***",
    });
  });

  // PUT /api/settings/ai — sauvegarde la config IA
  app.put<{ Body: AiConfig }>("/ai", async (req, reply) => {
    const { provider, apiKey, model, baseUrl } = req.body;
    if (!provider || !apiKey || !model) {
      return reply.status(400).send({ error: "provider, apiKey et model sont requis" });
    }
    saveAiConfig({ provider, apiKey, model, baseUrl });
    return reply.send({ ok: true });
  });

  // GET /api/settings/budgets
  app.get("/budgets", async (_req, reply) => {
    return reply.send(loadBudgets());
  });

  // PUT /api/settings/budgets
  app.put<{ Body: CategoryBudget[] }>("/budgets", async (req, reply) => {
    saveBudgets(req.body);
    return reply.send({ ok: true });
  });
}
