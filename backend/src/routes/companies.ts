import { FastifyInstance } from "fastify";
import {
  loadCompanies,
  createCompany,
  getActiveCompanyId,
  setActiveCompanyId,
  invalidateActiveCompanyCache,
  ensureDefaultCompany,
} from "../services/companiesService.js";
import { invalidateTransactionCache } from "../services/transactionService.js";

export async function companiesRoutes(app: FastifyInstance) {
  /** Liste toutes les entreprises */
  app.get("/", async () => {
    ensureDefaultCompany();
    return loadCompanies();
  });

  /** Retourne l'entreprise active */
  app.get("/active", async () => {
    ensureDefaultCompany();
    const companies = loadCompanies();
    const activeId = getActiveCompanyId();
    return companies.find((c) => c.id === activeId) ?? companies[0] ?? null;
  });

  /** Change l'entreprise active */
  app.put("/active", async (req, reply) => {
    const { companyId } = req.body as { companyId: string };
    ensureDefaultCompany();
    const companies = loadCompanies();
    if (!companies.find((c) => c.id === companyId)) {
      return reply.status(404).send({ error: "Entreprise introuvable" });
    }
    setActiveCompanyId(companyId);
    invalidateActiveCompanyCache();
    invalidateTransactionCache();
    return { ok: true };
  });

  /** Crée une nouvelle entreprise */
  app.post("/", async (req, reply) => {
    const { name } = req.body as { name: string };
    if (!name?.trim()) return reply.status(400).send({ error: "Nom requis" });
    const company = createCompany(name.trim());
    return reply.status(201).send(company);
  });
}
