import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { OutgoingInvoice } from "../types/index.js";
import { getActiveCompanyPath } from "./companiesService.js";

function getInvoicesFile(): string {
  return join(getActiveCompanyPath(), "settings", "invoices.json");
}

export function loadOutgoingInvoices(): OutgoingInvoice[] {
  const file = getInvoicesFile();
  if (!existsSync(file)) return [];
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as OutgoingInvoice[];
  } catch {
    return [];
  }
}

export function saveOutgoingInvoices(invoices: OutgoingInvoice[]): void {
  const file = getInvoicesFile();
  const dir = join(getActiveCompanyPath(), "settings");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify(invoices, null, 2), "utf-8");
}
