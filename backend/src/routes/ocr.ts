import { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import path from "path";
import fs from "fs/promises";
import { extractInvoiceFromPdf } from "../services/ocrService.js";
import { getWorkspaceRoot } from "../services/fileSystem.js";
import { loadAiConfig } from "../services/settingsService.js";

export async function ocrRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB max

  /**
   * POST /api/ocr/invoice
   * Multipart : field "file" → PDF
   * Retourne la facture extraite + le texte brut OCR.
   */
  app.post("/invoice", async (req, reply) => {
    const config = loadAiConfig();
    const mistralKey = config?.mistralApiKey ?? process.env.MISTRAL_API_KEY;
    if (!mistralKey) {
      return reply.status(503).send({ error: "Clé OCR Mistral non configurée. Ajoutez-la dans Paramètres → Configuration IA → Clé OCR Mistral." });
    }
    if (!config) {
      return reply.status(503).send({ error: "Fournisseur IA non configuré pour l'analyse des factures. Configurez-le dans Paramètres." });
    }

    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ error: "Aucun fichier reçu" });
    }

    const mimetype = data.mimetype;
    if (mimetype !== "application/pdf") {
      return reply.status(400).send({ error: "Seuls les fichiers PDF sont acceptés" });
    }

    const buffer = await data.toBuffer();
    const filename = data.filename;

    // Sauvegarde le PDF dans workspace/attachments/
    const attachmentsDir = path.join(getWorkspaceRoot(), "attachments");
    await fs.mkdir(attachmentsDir, { recursive: true });
    await fs.writeFile(path.join(attachmentsDir, filename), buffer);

    const { invoice, rawText } = await extractInvoiceFromPdf(buffer, filename);

    return reply.send({ invoice, rawText: rawText.slice(0, 500) });
  });
}
