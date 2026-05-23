import { FastifyInstance } from "fastify";
import { generateReport, ReportType } from "../services/reportService.js";
import { loadAllTransactions } from "../services/transactionService.js";

export async function reportsRoutes(app: FastifyInstance) {
  /**
   * POST /api/reports/generate
   */
  app.post<{ Body: { type: ReportType; period: string } }>("/generate", async (req, reply) => {
    const { type, period } = req.body;
    if (!type || !period) return reply.status(400).send({ error: "type et period requis" });
    const validTypes: ReportType[] = ["monthly", "vat", "activity"];
    if (!validTypes.includes(type)) return reply.status(400).send({ error: `type invalide` });
    const { content, filePath } = await generateReport({ type, period });
    return reply.send({ content, filePath });
  });

  /**
   * GET /api/reports/vat-summary?year=2025
   * Retourne la TVA collectée, déductible et à reverser par trimestre.
   */
  app.get<{ Querystring: { year?: string } }>("/vat-summary", async (req, reply) => {
    const year = req.query.year ?? String(new Date().getFullYear());
    const all = await loadAllTransactions();
    const txns = all.filter(
      (t) => t.date.startsWith(year) && t.status !== "rejected"
    );

    // Calcul par trimestre
    const quarters = [
      { label: "T1", months: ["01", "02", "03"] },
      { label: "T2", months: ["04", "05", "06"] },
      { label: "T3", months: ["07", "08", "09"] },
      { label: "T4", months: ["10", "11", "12"] },
    ];

    const rows = quarters.map(({ label, months }) => {
      const qt = txns.filter((t) => months.includes(t.date.slice(5, 7)));
      const collected = qt
        .filter((t) => t.amount_ttc > 0)
        .reduce((s, t) => s + t.vat, 0);
      const deductible = qt
        .filter((t) => t.amount_ttc < 0)
        .reduce((s, t) => s + Math.abs(t.vat), 0);
      return {
        quarter: label,
        collected: parseFloat(collected.toFixed(2)),
        deductible: parseFloat(deductible.toFixed(2)),
        net: parseFloat((collected - deductible).toFixed(2)),
        revenue: parseFloat(qt.filter((t) => t.amount_ttc > 0).reduce((s, t) => s + t.amount_ttc, 0).toFixed(2)),
        expenses: parseFloat(qt.filter((t) => t.amount_ttc < 0).reduce((s, t) => s + Math.abs(t.amount_ttc), 0).toFixed(2)),
      };
    });

    const totalCollected = rows.reduce((s, r) => s + r.collected, 0);
    const totalDeductible = rows.reduce((s, r) => s + r.deductible, 0);

    return reply.send({
      year,
      quarters: rows,
      total: {
        collected: parseFloat(totalCollected.toFixed(2)),
        deductible: parseFloat(totalDeductible.toFixed(2)),
        net: parseFloat((totalCollected - totalDeductible).toFixed(2)),
      },
    });
  });

  /**
   * GET /api/reports/pnl?year=2025
   * Retourne le compte de résultat structuré (PCG), avec SIG.
   */
  app.get<{ Querystring: { year?: string } }>("/pnl", async (req, reply) => {
    const year = req.query.year ?? String(new Date().getFullYear());
    const all = await loadAllTransactions();
    const txns = all.filter((t) => t.date.startsWith(year) && t.status !== "rejected");

    const CHARGES_PCG: Record<string, [string, string]> = {
      hosting:      ["616200", "Hébergement web"],
      software:     ["615600", "Logiciels"],
      salary:       ["641100", "Salaires bruts"],
      travel:       ["625100", "Voyages et déplacements"],
      restaurant:   ["625700", "Réceptions"],
      food:         ["606000", "Achats divers"],
      taxes:        ["447900", "Impôts et taxes"],
      equipment:    ["218300", "Matériel informatique"],
      subscription: ["622600", "Abonnements"],
      rent:         ["613200", "Loyers"],
      legal:        ["622200", "Honoraires"],
      insurance:    ["616000", "Assurances"],
      misc:         ["628800", "Charges diverses"],
    };

    const chargesMap: Record<string, { account: string; label: string; amount: number; count: number }> = {};
    let totalRevHT = 0;
    let revenueCount = 0;

    for (const t of txns) {
      if (t.amount_ht < 0) {
        const [account, label] = CHARGES_PCG[t.category] ?? ["628800", "Charges diverses"];
        if (!chargesMap[account]) chargesMap[account] = { account, label, amount: 0, count: 0 };
        chargesMap[account].amount += Math.abs(t.amount_ht);
        chargesMap[account].count++;
      } else if (t.amount_ht > 0) {
        totalRevHT += t.amount_ht;
        revenueCount++;
      }
    }

    const charges = Object.values(chargesMap).sort((a, b) => b.amount - a.amount);
    const totalCharges = charges.reduce((s, c) => s + c.amount, 0);
    const resultatBrut = totalRevHT - totalCharges;
    const isEstimate = resultatBrut > 0 ? resultatBrut * 0.25 : 0;

    return reply.send({
      year,
      produits: [{ account: "706000", label: "Prestations de services / Ventes", amount: parseFloat(totalRevHT.toFixed(2)), count: revenueCount }],
      charges: charges.map((c) => ({ ...c, amount: parseFloat(c.amount.toFixed(2)) })),
      total_produits: parseFloat(totalRevHT.toFixed(2)),
      total_charges: parseFloat(totalCharges.toFixed(2)),
      resultat_brut: parseFloat(resultatBrut.toFixed(2)),
      is_estimate: parseFloat(isEstimate.toFixed(2)),
      resultat_net: parseFloat((resultatBrut - isEstimate).toFixed(2)),
    });
  });
}

