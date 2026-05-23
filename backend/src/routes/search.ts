import { FastifyInstance } from "fastify";
import { search } from "../services/searchService.js";
import { loadAllTransactions } from "../services/transactionService.js";

export async function searchRoutes(app: FastifyInstance) {
  // GET /api/search?q=ovh&limit=20
  app.get<{ Querystring: { q: string; limit?: string } }>("/", async (req, reply) => {
    const { q, limit } = req.query;
    if (!q || q.trim().length < 1) {
      return reply.send([]);
    }
    const results = await search(q.trim(), limit ? parseInt(limit) : 30);
    return reply.send(results);
  });

  // GET /api/search/tags — liste tous les tags uniques utilisés
  app.get("/tags", async (_req, reply) => {
    const transactions = await loadAllTransactions();
    const tags = new Set<string>();
    for (const txn of transactions) {
      txn.tags?.forEach((t) => tags.add(t));
    }
    return reply.send(Array.from(tags).sort());
  });
}
