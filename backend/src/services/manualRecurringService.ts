import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { getActiveCompanyPath } from "./companiesService.js";

function getManualFile(): string {
  return join(getActiveCompanyPath(), "settings", "manual_recurring.json");
}

export interface ManualRecurring {
  id: string;
  label: string;
  category: string;
  amount: number; // montant positif (dépense)
  frequency: "mensuel" | "trimestriel" | "annuel";
  nextPayment: string; // ISO YYYY-MM-DD
  active: boolean;
}

export function loadManualRecurring(): ManualRecurring[] {
  const file = getManualFile();
  if (!existsSync(file)) return [];
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as ManualRecurring[];
  } catch {
    return [];
  }
}

export function saveManualRecurring(entries: ManualRecurring[]): void {
  const file = getManualFile();
  const dir = join(getActiveCompanyPath(), "settings");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify(entries, null, 2), "utf-8");
}
