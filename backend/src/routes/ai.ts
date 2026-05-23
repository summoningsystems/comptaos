import { FastifyInstance } from "fastify";
import { categorizeTransaction, chatWithCopilot, ChatMessage, CopilotContext } from "../services/aiService.js";
import { loadAllTransactions } from "../services/transactionService.js";
import { computeDashboard } from "../services/dashboardService.js";
import { loadAiConfig } from "../services/settingsService.js";

export async function aiRoutes(app: FastifyInstance) {
  /**
   * POST /api/ai/categorize
   * Body: { label: string, amount: number }
   */
  app.post<{ Body: { label: string; amount: number } }>("/categorize", async (req, reply) => {
    const { label, amount } = req.body;
    if (!label || amount === undefined) {
      return reply.status(400).send({ error: "label et amount requis" });
    }
    if (!loadAiConfig()) {
      return reply.status(503).send({ error: "Aucun fournisseur d'IA configuré. Rendez-vous dans Paramètres → Intelligence Artificielle." });
    }
    const history = await loadAllTransactions();
    const recent = history.slice(0, 20).map((t) => ({ label: t.label, category: t.category }));
    const result = await categorizeTransaction(label, amount, recent);
    return reply.send(result);
  });

  /**
   * POST /api/ai/chat
   * Body: { messages: ChatMessage[] }
   */
  app.post<{ Body: { messages: ChatMessage[] } }>("/chat", async (req, reply) => {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return reply.status(400).send({ error: "messages requis" });
    }
    if (!loadAiConfig()) {
      return reply.status(503).send({ error: "Aucun fournisseur d'IA configuré. Rendez-vous dans Paramètres → Intelligence Artificielle." });
    }
    const [transactions, dashboard] = await Promise.all([loadAllTransactions(), computeDashboard()]);
    const context: CopilotContext = {
      transactions: transactions.map((t) => ({ date: t.date, label: t.label, amount_ttc: t.amount_ttc, category: t.category })),
      treasury: dashboard.treasury,
      vat_estimate: dashboard.vat_estimate,
    };
    const answer = await chatWithCopilot(messages, context);
    return reply.send({ answer });
  });
}
