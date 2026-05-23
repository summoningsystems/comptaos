import { FastifyInstance } from "fastify";
import { loadOutgoingInvoices, saveOutgoingInvoices } from "../services/invoiceService.js";
import { OutgoingInvoice } from "../types/index.js";

export async function invoicesRoutes(app: FastifyInstance) {
  app.get("/", async (_req, reply) => {
    return reply.send(loadOutgoingInvoices());
  });

  app.post<{ Body: OutgoingInvoice }>("/", async (req, reply) => {
    const invoices = loadOutgoingInvoices();
    invoices.push(req.body);
    saveOutgoingInvoices(invoices);
    return reply.status(201).send(req.body);
  });

  app.put<{ Params: { id: string }; Body: OutgoingInvoice }>("/:id", async (req, reply) => {
    const invoices = loadOutgoingInvoices().map((inv) =>
      inv.id === req.params.id ? req.body : inv
    );
    saveOutgoingInvoices(invoices);
    return reply.send(req.body);
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const invoices = loadOutgoingInvoices().filter((inv) => inv.id !== req.params.id);
    saveOutgoingInvoices(invoices);
    return reply.status(204).send();
  });
}
