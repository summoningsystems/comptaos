/**
 * spreadsheetWorker.ts — Web Worker pour le calcul des formules HyperFormula.
 * Tourne dans un thread OS séparé : l'UI ne gèle jamais pendant la réévaluation.
 *
 * Protocol postMessage :
 *   → { type: "COMPUTE", sheetCells, vars, version }
 *   ← { type: "RESULT",  computed, version }
 *   ← { type: "ERROR",   message, version }
 */

import { HyperFormula } from "hyperformula";

// ── Helpers (dupliqués ici pour être auto-contenus dans le worker) ──────────

function colLetter(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function parseCell(key: string): { col: number; row: number } | null {
  const m = key.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  return {
    col: m[1].split("").reduce((acc, c) => acc * 26 + c.charCodeAt(0) - 64, 0) - 1,
    row: parseInt(m[2], 10) - 1,
  };
}

// ── Types (inline pour ne pas importer spreadsheetTypes) ────────────────────

interface WorkerCell {
  value: string | number | null;
}

interface ComputeRequest {
  type: "COMPUTE";
  sheetCells: Record<string, WorkerCell>;
  vars: Record<string, number>;
  version: number;
}

// ── Handler principal ───────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<ComputeRequest>) => {
  const { type, sheetCells, vars, version } = e.data;
  if (type !== "COMPUTE") return;

  try {
    // 1. Détecter les dimensions réelles de la feuille
    let maxRow = 0, maxCol = 0;
    const entries = Object.entries(sheetCells).filter(
      ([, cell]) => cell.value !== null && cell.value !== undefined && cell.value !== ""
    );

    for (const [key] of entries) {
      const pos = parseCell(key);
      if (pos) {
        if (pos.row > maxRow) maxRow = pos.row;
        if (pos.col > maxCol) maxCol = pos.col;
      }
    }

    const usedRows = maxRow + 1;
    const usedCols = maxCol + 1;

    // 2. Construire la matrice (uniquement la plage utilisée)
    const matrix: (string | number | null)[][] = Array.from(
      { length: usedRows },
      () => Array(usedCols).fill(null)
    );
    for (const [key, cell] of entries) {
      const pos = parseCell(key);
      if (pos && pos.row < usedRows && pos.col < usedCols) {
        matrix[pos.row][pos.col] = cell.value;
      }
    }

    // 3. Instancier HyperFormula
    const hf = HyperFormula.buildFromArray(matrix, {
      licenseKey: "gpl-v3",
      // Désactiver les fonctions inutilisées pour réduire le temps d'init
      functionPlugins: [],
    });

    // 4. Injecter les variables comptables (ex: TOTAL_DEPENSES)
    for (const [name, value] of Object.entries(vars)) {
      try {
        hf.addNamedExpression(name.toUpperCase(), value.toString());
      } catch {
        /* ignore si déjà défini */
      }
    }

    // 5. Évaluer toutes les cellules
    const computed: Record<string, string | number | null> = {};
    for (const [key, cell] of Object.entries(sheetCells)) {
      if (!cell.value && cell.value !== 0) continue;
      const pos = parseCell(key);
      if (!pos) continue;

      // Cellule hors de la plage construite → valeur brute
      if (pos.row >= usedRows || pos.col >= usedCols) {
        computed[key] = cell.value;
        continue;
      }

      try {
        const raw = hf.getCellValue({ sheet: 0, row: pos.row, col: pos.col });
        computed[key] = raw instanceof Error
          ? `#ERR:${raw.message.slice(0, 16)}`
          : (raw as string | number | null);
      } catch {
        computed[key] = cell.value;
      }
    }

    // 6. Libérer la mémoire HyperFormula
    hf.destroy();

    // 7. Renvoyer le résultat au thread principal
    self.postMessage({ type: "RESULT", computed, version });

  } catch (err) {
    self.postMessage({
      type: "ERROR",
      message: (err as Error).message ?? "Erreur inconnue",
      version,
    });
  }
};
