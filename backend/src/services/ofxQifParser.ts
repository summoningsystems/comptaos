import { randomUUID } from "crypto";
import { Transaction } from "../types/index.js";

// ── OFX Parser ────────────────────────────────────────────────────────────────

function parseOfxDate(raw: string): string {
  // Format OFX: YYYYMMDDHHMMSS ou YYYYMMDD
  const d = raw.replace(/\[.*/, "").trim();
  const year = d.slice(0, 4);
  const month = d.slice(4, 6);
  const day = d.slice(6, 8);
  return `${year}-${month}-${day}`;
}

export function parseOfx(content: string): Partial<Transaction>[] {
  const results: Partial<Transaction>[] = [];
  // Extract STMTTRN blocks
  const blockRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  while ((match = blockRegex.exec(content)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = new RegExp(`<${tag}>([^<\n\r]+)`, "i").exec(block);
      return m ? m[1].trim() : "";
    };
    const amount = parseFloat(get("TRNAMT").replace(",", "."));
    if (isNaN(amount)) continue;
    const date = get("DTPOSTED");
    const label = get("MEMO") || get("NAME") || get("CHECKNUM") || "OFX transaction";
    results.push({
      id: randomUUID(),
      date: parseOfxDate(date),
      label,
      amount_ttc: amount,
      amount_ht: parseFloat((amount / 1.2).toFixed(2)),
      vat: parseFloat((amount - amount / 1.2).toFixed(2)),
      currency: "EUR",
      category: "misc",
      account: "import-ofx",
      status: "pending",
      tags: [],
    });
  }
  return results;
}

// ── QIF Parser ────────────────────────────────────────────────────────────────

export function parseQif(content: string): Partial<Transaction>[] {
  const results: Partial<Transaction>[] = [];
  const transactions = content.split("^").map((b) => b.trim()).filter(Boolean);

  for (const block of transactions) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    let date = "";
    let amount = 0;
    let label = "";

    for (const line of lines) {
      const code = line[0];
      const value = line.slice(1).trim();
      if (code === "D") {
        // Date formats: M/D/Y, M/D'-Y, MM/DD/YYYY
        const parts = value.replace(/-/g, "/").split("/");
        if (parts.length === 3) {
          const [m, d, y] = parts;
          const year = y.length === 2 ? `20${y}` : y;
          date = `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        }
      }
      if (code === "T" || code === "U") {
        amount = parseFloat(value.replace(/,/g, "").replace(" ", ""));
      }
      if (code === "P" || code === "M") {
        label = label || value;
      }
    }

    if (!date || isNaN(amount)) continue;
    results.push({
      id: randomUUID(),
      date,
      label: label || "QIF transaction",
      amount_ttc: amount,
      amount_ht: parseFloat((amount / 1.2).toFixed(2)),
      vat: parseFloat((amount - amount / 1.2).toFixed(2)),
      currency: "EUR",
      category: "misc",
      account: "import-qif",
      status: "pending",
      tags: [],
    });
  }

  return results;
}
