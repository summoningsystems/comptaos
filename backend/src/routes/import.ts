import { FastifyInstance } from "fastify";
import Papa from "papaparse";
import { parseCsv } from "../services/csvParser.js";
import { loadAllTransactions, saveTransactions } from "../services/transactionService.js";
import { loadCategoryRules } from "../services/settingsService.js";
import { CsvMappingConfig } from "../types/index.js";
import { autoCommit } from "../services/gitService.js";
import { getWorkspaceRoot } from "../services/fileSystem.js";
import { parseOfx, parseQif } from "../services/ofxQifParser.js";

export async function importRoutes(app: FastifyInstance) {
  /**
   * POST /api/import/csv
   * Body (multipart) :
   *   - file : le fichier CSV
   *   - mapping : JSON stringifié du CsvMappingConfig
   * OU Body (JSON) :
   *   - content : string CSV brut
   *   - mapping : CsvMappingConfig
   */
  app.post<{ Body: { content: string; mapping: CsvMappingConfig } }>("/csv", async (req, reply) => {
    const { content, mapping } = req.body;

    if (!content || !mapping) {
      return reply.status(400).send({ error: "content et mapping sont requis" });
    }

    const rules = loadCategoryRules();
    const transactions = parseCsv(content, mapping, rules);

    if (transactions.length === 0) {
      return reply.status(422).send({ error: "Aucune transaction trouvée dans le CSV" });
    }

    // Déduplication : ignorer les transactions déjà présentes (même date + libellé + montant)
    const existing = await loadAllTransactions();
    const fingerprints = new Set(
      existing.map((t) => `${t.date}|${t.label.trim().toLowerCase()}|${t.amount_ttc}`)
    );
    const newTxns = transactions.filter(
      (t) => !fingerprints.has(`${t.date}|${t.label.trim().toLowerCase()}|${t.amount_ttc}`)
    );

    await saveTransactions(newTxns);
    if (newTxns.length > 0) {
      autoCommit(getWorkspaceRoot(), `import CSV: ${newTxns.length} transaction(s) ajoutée(s)`).catch(() => {});
    }

    return reply.status(201).send({
      imported: newTxns.length,
      skipped: transactions.length - newTxns.length,
      transactions: newTxns,
    });
  });

  /**
   * POST /api/import/preview
   * Retourne un aperçu des colonnes détectées sans sauvegarder.
   * Utilise PapaParse pour gérer correctement les valeurs quotées (ex: "1 060,80 €").
   */
  app.post<{ Body: { content: string } }>("/preview", async (req, reply) => {
    const { content } = req.body;
    if (!content) return reply.status(400).send({ error: "content requis" });

    const result = Papa.parse<string[]>(content, {
      header: false,
      skipEmptyLines: true,
      dynamicTyping: false,
    });

    if (result.data.length < 2) {
      return reply.status(422).send({ error: "CSV trop court" });
    }

    const columns: string[] = (result.data[0] as string[]).map((c) => String(c).trim());
    const samples: string[][] = result.data
      .slice(1, 4)
      .map((row) => (row as string[]).map((c) => String(c).trim()));

    return reply.send({ columns, samples });
  });

  /**
   * POST /api/import/ofx — Importer un fichier OFX/OFC
   */
  app.post<{ Body: { content: string } }>("/ofx", async (req, reply) => {
    const { content } = req.body;
    if (!content) return reply.status(400).send({ error: "content requis" });

    const parsed = parseOfx(content);
    if (parsed.length === 0) {
      return reply.status(422).send({ error: "Aucune transaction trouvée dans le fichier OFX" });
    }

    const existing = await loadAllTransactions();
    const fingerprints = new Set(
      existing.map((t) => `${t.date}|${t.label.trim().toLowerCase()}|${t.amount_ttc}`)
    );
    const newTxns = parsed.filter(
      (t) => !fingerprints.has(`${t.date}|${(t.label ?? "").trim().toLowerCase()}|${t.amount_ttc}`)
    ) as import("../types/index.js").Transaction[];

    await saveTransactions(newTxns);
    if (newTxns.length > 0) {
      autoCommit(getWorkspaceRoot(), `import OFX: ${newTxns.length} transaction(s) ajoutée(s)`).catch(() => {});
    }

    return reply.status(201).send({ imported: newTxns.length, skipped: parsed.length - newTxns.length, transactions: newTxns });
  });

  /**
   * POST /api/import/qif — Importer un fichier QIF
   */
  app.post<{ Body: { content: string } }>("/qif", async (req, reply) => {
    const { content } = req.body;
    if (!content) return reply.status(400).send({ error: "content requis" });

    const parsed = parseQif(content);
    if (parsed.length === 0) {
      return reply.status(422).send({ error: "Aucune transaction trouvée dans le fichier QIF" });
    }

    const existing = await loadAllTransactions();
    const fingerprints = new Set(
      existing.map((t) => `${t.date}|${t.label.trim().toLowerCase()}|${t.amount_ttc}`)
    );
    const newTxns = parsed.filter(
      (t) => !fingerprints.has(`${t.date}|${(t.label ?? "").trim().toLowerCase()}|${t.amount_ttc}`)
    ) as import("../types/index.js").Transaction[];

    await saveTransactions(newTxns);
    if (newTxns.length > 0) {
      autoCommit(getWorkspaceRoot(), `import QIF: ${newTxns.length} transaction(s) ajoutée(s)`).catch(() => {});
    }

    return reply.status(201).send({ imported: newTxns.length, skipped: parsed.length - newTxns.length, transactions: newTxns });
  });
}
