import { FastifyInstance } from "fastify";
import { loadAllTransactions, updateTransaction } from "../services/transactionService.js";
import { autoCommit } from "../services/gitService.js";
import { getWorkspaceRoot } from "../services/fileSystem.js";

export async function reconcileRoutes(app: FastifyInstance) {
  /** GET /api/reconcile — liste les transactions non réconciliées */
  app.get<{ Querystring: { month?: string } }>("/", async (req, reply) => {
    const { month } = req.query;
    const all = await loadAllTransactions();
    const filtered = all.filter((t) => {
      if (t.status === "rejected") return false;
      if (month && !t.date.startsWith(month)) return false;
      return true;
    }).sort((a, b) => a.date.localeCompare(b.date));

    const reconciled = filtered.filter((t) => t.reconciled).length;
    const total = filtered.length;

    return reply.send({ transactions: filtered, reconciled, total, pending: total - reconciled });
  });

  /** PATCH /api/reconcile/:id — toggle réconciliation d'une transaction */
  app.patch<{ Params: { id: string }; Body: { reconciled: boolean } }>("/:id", async (req, reply) => {
    const { reconciled } = req.body;
    const updated = await updateTransaction(req.params.id, { reconciled });
    autoCommit(getWorkspaceRoot(), `rapprochement: ${req.params.id} ${reconciled ? "✓" : "annulé"}`).catch(() => {});
    return reply.send(updated);
  });

  /** POST /api/reconcile/bulk — réconciliation en masse */
  app.post<{ Body: { ids: string[]; reconciled: boolean } }>("/bulk", async (req, reply) => {
    const { ids, reconciled } = req.body;
    const results = await Promise.all(ids.map((id) => updateTransaction(id, { reconciled })));
    autoCommit(getWorkspaceRoot(), `rapprochement: ${ids.length} transaction(s) ${reconciled ? "validées" : "annulées"}`).catch(() => {});
    return reply.send({ updated: results.length });
  });
}
