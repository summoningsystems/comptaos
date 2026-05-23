import { FastifyInstance } from "fastify";
import {
  loadManualRecurring,
  saveManualRecurring,
  ManualRecurring,
} from "../services/manualRecurringService.js";

export async function recurringRoutes(app: FastifyInstance) {
  app.get("/manual", async () => {
    return loadManualRecurring();
  });

  app.put<{ Body: ManualRecurring[] }>("/manual", async (req, reply) => {
    const entries = req.body;
    if (!Array.isArray(entries)) {
      return reply.status(400).send({ error: "body doit être un tableau" });
    }
    saveManualRecurring(entries);
    return reply.send({ saved: entries.length });
  });
}
