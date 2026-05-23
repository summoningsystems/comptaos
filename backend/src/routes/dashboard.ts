import { FastifyInstance } from "fastify";
import { computeDashboard } from "../services/dashboardService.js";

export async function dashboardRoutes(app: FastifyInstance) {
  // GET /api/dashboard
  app.get("/", async (_req, reply) => {
    const data = await computeDashboard();
    return reply.send(data);
  });
}
