import { describe, it, expect } from "vitest";

// Helpers utilitaires (logique pure, sans DOM ni API)

/** Formate un nombre en devise française */
function formatCurrency(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}

/** Calcule le taux de marge */
function marginRate(revenue: number, result: number): number | null {
  if (revenue === 0) return null;
  return (result / revenue) * 100;
}

/** Détermine si une transaction est en attente */
function isPending(status: string): boolean {
  return status === "pending";
}

/** Filtre les transactions d'une année donnée */
function filterByYear(
  txns: Array<{ date: string; status: string }>,
  year: string
): Array<{ date: string; status: string }> {
  return txns.filter((t) => t.date.startsWith(year) && t.status !== "rejected");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("formatCurrency", () => {
  it("formate zéro", () => expect(formatCurrency(0)).toBe("0 €"));
  it("formate un entier", () => expect(formatCurrency(1500)).toMatch(/1.500\s€/u));
  it("formate un négatif", () => expect(formatCurrency(-250)).toBe("-250 €"));
});

describe("marginRate", () => {
  it("retourne null si revenu = 0", () => expect(marginRate(0, 100)).toBeNull());
  it("calcule un taux positif", () => expect(marginRate(10000, 3000)).toBeCloseTo(30));
  it("calcule un taux négatif", () => expect(marginRate(5000, -1000)).toBeCloseTo(-20));
});

describe("isPending", () => {
  it("pending → true", () => expect(isPending("pending")).toBe(true));
  it("validated → false", () => expect(isPending("validated")).toBe(false));
  it("rejected → false", () => expect(isPending("rejected")).toBe(false));
});

describe("filterByYear", () => {
  const txns = [
    { date: "2025-01-15", status: "validated" },
    { date: "2025-06-01", status: "pending" },
    { date: "2025-08-10", status: "rejected" },
    { date: "2024-11-30", status: "validated" },
  ];

  it("retourne les transactions de 2025 non rejetées", () => {
    const r = filterByYear(txns, "2025");
    expect(r).toHaveLength(2);
    expect(r.every((t) => t.date.startsWith("2025"))).toBe(true);
  });

  it("exclut les transactions rejetées", () => {
    const r = filterByYear(txns, "2025");
    expect(r.some((t) => t.status === "rejected")).toBe(false);
  });

  it("retourne vide pour une année sans transactions", () => {
    expect(filterByYear(txns, "2023")).toHaveLength(0);
  });
});
