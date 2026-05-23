import { FastifyInstance } from "fastify";
import * as fs from "fs";
import * as path from "path";
import { getWorkspaceRoot } from "../services/fileSystem.js";
import yaml from "js-yaml";
import { randomUUID } from "crypto";
import { Category } from "../types/index.js";
import { autoCommit } from "../services/gitService.js";

export interface TransactionTemplate {
  id: string;
  name: string;
  label: string;
  amount_ttc: number;
  amount_ht: number;
  vat: number;
  category: Category;
  account: string;
  tags?: string[];
  notes?: string;
}

function getTemplatesPath(): string {
  return path.join(getWorkspaceRoot(), "templates.yaml");
}

function loadTemplates(): TransactionTemplate[] {
  const p = getTemplatesPath();
  if (!fs.existsSync(p)) return [];
  try {
    const raw = yaml.load(fs.readFileSync(p, "utf8")) as { templates?: TransactionTemplate[] };
    return raw?.templates ?? [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: TransactionTemplate[]): void {
  fs.writeFileSync(getTemplatesPath(), yaml.dump({ templates }), "utf8");
}

export async function templatesRoutes(app: FastifyInstance) {
  /** GET /api/templates */
  app.get("/", (_req, reply) => {
    return reply.send({ templates: loadTemplates() });
  });

  /** POST /api/templates — créer un template */
  app.post<{ Body: Omit<TransactionTemplate, "id"> }>("/", (req, reply) => {
    const templates = loadTemplates();
    const template: TransactionTemplate = { id: randomUUID(), ...req.body };
    templates.push(template);
    saveTemplates(templates);
    autoCommit(getWorkspaceRoot(), `modèle: ajout "${template.name}"`).catch(() => {});
    return reply.status(201).send(template);
  });

  /** PATCH /api/templates/:id */
  app.patch<{ Params: { id: string }; Body: Partial<TransactionTemplate> }>("/:id", (req, reply) => {
    const templates = loadTemplates();
    const idx = templates.findIndex((t) => t.id === req.params.id);
    if (idx === -1) return reply.status(404).send({ error: "Template introuvable" });
    templates[idx] = { ...templates[idx], ...req.body };
    saveTemplates(templates);
    return reply.send(templates[idx]);
  });

  /** DELETE /api/templates/:id */
  app.delete<{ Params: { id: string } }>("/:id", (req, reply) => {
    const templates = loadTemplates();
    const idx = templates.findIndex((t) => t.id === req.params.id);
    if (idx === -1) return reply.status(404).send({ error: "Template introuvable" });
    templates.splice(idx, 1);
    saveTemplates(templates);
    return reply.send({ ok: true });
  });
}
