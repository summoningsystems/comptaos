import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { Quote } from "../types/index.js";
import { getActiveCompanyPath } from "./companiesService.js";

function getQuotesFile(): string {
  return join(getActiveCompanyPath(), "settings", "quotes.json");
}

export function loadQuotes(): Quote[] {
  const file = getQuotesFile();
  if (!existsSync(file)) return [];
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as Quote[];
  } catch {
    return [];
  }
}

export function saveQuotes(quotes: Quote[]): void {
  const file = getQuotesFile();
  const dir = join(getActiveCompanyPath(), "settings");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify(quotes, null, 2), "utf-8");
}
