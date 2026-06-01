import { FastifyInstance } from "fastify";
import { loadQuotes, saveQuotes } from "../services/quoteService.js";
import { loadOutgoingInvoices, saveOutgoingInvoices } from "../services/invoiceService.js";
import { Quote, OutgoingInvoice } from "../types/index.js";

export async function quotesRoutes(app: FastifyInstance) {
  // GET /api/quotes
  app.get("/", async () => loadQuotes());

  // POST /api/quotes
  app.post<{ Body: Quote }>("/", async (req, reply) => {
    const quotes = loadQuotes();
    quotes.push(req.body);
    saveQuotes(quotes);
    return reply.status(201).send(req.body);
  });

  // PUT /api/quotes/:id
  app.put<{ Params: { id: string }; Body: Quote }>("/:id", async (req, reply) => {
    const quotes = loadQuotes();
    const idx = quotes.findIndex((q) => q.id === req.params.id);
    if (idx === -1) return reply.status(404).send({ error: "Not found" });
    quotes[idx] = req.body;
    saveQuotes(quotes);
    return quotes[idx];
  });

  // DELETE /api/quotes/:id
  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const quotes = loadQuotes().filter((q) => q.id !== req.params.id);
    saveQuotes(quotes);
    return reply.status(204).send();
  });

  // POST /api/quotes/:id/convert — convertit un devis en facture
  app.post<{ Params: { id: string } }>("/:id/convert", async (req, reply) => {
    const quotes = loadQuotes();
    const idx = quotes.findIndex((q) => q.id === req.params.id);
    if (idx === -1) return reply.status(404).send({ error: "Not found" });

    const quote = quotes[idx];
    const invoices = loadOutgoingInvoices();

    const invoice: OutgoingInvoice = {
      id: crypto.randomUUID(),
      number: `FA-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, "0")}`,
      client: quote.client,
      date: new Date().toISOString().slice(0, 10),
      dueDate: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().slice(0, 10);
      })(),
      description: quote.description,
      amount_ht: quote.amount_ht,
      vat_rate: quote.vat_rate,
      amount_ttc: quote.amount_ttc,
      status: "draft",
      notes: quote.notes,
    };

    invoices.push(invoice);
    saveOutgoingInvoices(invoices);

    // Marquer le devis comme converti
    quotes[idx] = { ...quote, status: "converted", invoiceId: invoice.id };
    saveQuotes(quotes);

    return reply.status(201).send(invoice);
  });
}
