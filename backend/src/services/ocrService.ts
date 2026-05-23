import { Mistral } from "@mistralai/mistralai";
import { Invoice } from "../types/index.js";
import { nanoid } from "../utils/id.js";
import { loadAiConfig } from "./settingsService.js";
import { callAi } from "./aiService.js";

function getMistralClient(): Mistral {
  const config = loadAiConfig();
  const apiKey = config?.mistralApiKey ?? process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("Clé Mistral OCR non configurée. Ajoutez-la dans Paramètres → OCR Mistral.");
  return new Mistral({ apiKey });
}

/**
 * Extrait le texte d'un PDF via l'API OCR de Mistral.
 */
async function extractTextFromPdf(pdfBase64: string): Promise<string> {
  const mistral = getMistralClient();

  const response = await mistral.ocr.process({
    model: "mistral-ocr-latest",
    document: {
      type: "document_url",
      documentUrl: `data:application/pdf;base64,${pdfBase64}`,
    },
  });

  // Concatenate all pages markdown
  return response.pages.map((p: { markdown: string }) => p.markdown).join("\n\n");
}

/**
 * Parse le texte extrait par OCR en structure de facture via le fournisseur IA configuré.
 */
async function parseInvoiceText(rawText: string): Promise<Partial<Invoice>> {
  const system = `Tu es un assistant comptable. Extrait les informations d'une facture et réponds UNIQUEMENT avec un JSON valide (sans markdown ni balise code).`;
  const prompt = `Voici le texte d'une facture. Retourne ce JSON exact :
{
  "supplier": "<nom du fournisseur>",
  "date": "<YYYY-MM-DD ou null>",
  "vat_rate": <0, 5.5, 10, ou 20>,
  "amount_ht": <montant HT en nombre>,
  "amount_ttc": <montant TTC en nombre>,
  "category": "<hosting|software|salary|travel|restaurant|taxes|equipment|subscription|misc>"
}

Texte de la facture :
${rawText.slice(0, 3000)}`;

  const text = await callAi(system, prompt, 512);
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? (JSON.parse(jsonMatch[0]) as Partial<Invoice>) : {};
  } catch {
    return {};
  }
}

/**
 * Pipeline complet : PDF buffer → texte OCR → facture structurée.
 */
export async function extractInvoiceFromPdf(
  pdfBuffer: Buffer,
  filename: string
): Promise<{ invoice: Partial<Invoice>; rawText: string }> {
  const base64 = pdfBuffer.toString("base64");
  const rawText = await extractTextFromPdf(base64);
  const parsed = await parseInvoiceText(rawText);

  const invoice: Partial<Invoice> = {
    id: `inv_${nanoid()}`,
    supplier: parsed.supplier ?? "Inconnu",
    date: parsed.date ?? new Date().toISOString().slice(0, 10),
    vat_rate: parsed.vat_rate ?? 20,
    amount_ht: parsed.amount_ht ?? 0,
    amount_ttc: parsed.amount_ttc ?? 0,
    category: parsed.category ?? "misc",
    file: `attachments/${filename}`,
  };

  return { invoice, rawText };
}
