import { FastifyInstance } from "fastify";
import fs from "fs/promises";
import path from "path";
import { getWorkspaceRoot } from "../services/fileSystem.js";

interface WaitlistEntry {
  email: string;
  plan: string;
  source: string;
  registeredAt: string;
}

const WAITLIST_FILE = () => path.join(getWorkspaceRoot(), ".waitlist.json");

async function loadEntries(): Promise<WaitlistEntry[]> {
  try {
    const raw = await fs.readFile(WAITLIST_FILE(), "utf-8");
    return JSON.parse(raw) as WaitlistEntry[];
  } catch {
    return [];
  }
}

export async function waitlistRoutes(app: FastifyInstance) {
  // Inscrire un email
  app.post("/api/waitlist", async (req, reply) => {
    const { email, plan = "pro_plus", source = "app" } = req.body as {
      email?: string;
      plan?: string;
      source?: string;
    };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return reply.status(400).send({ error: "Email invalide" });
    }

    const entries = await loadEntries();
    if (entries.find((e) => e.email === email)) {
      return { ok: true, message: "Vous êtes déjà inscrit sur la liste !" };
    }

    entries.push({
      email: email.trim().toLowerCase(),
      plan,
      source,
      registeredAt: new Date().toISOString(),
    });
    await fs.writeFile(WAITLIST_FILE(), JSON.stringify(entries, null, 2));

    return { ok: true, message: "Inscription confirmée ! Nous vous contacterons en priorité." };
  });

  // Nombre d'inscrits (public — pas d'emails exposés)
  app.get("/api/waitlist/count", async () => {
    const entries = await loadEntries();
    return { count: entries.length };
  });

  // Liste complète (admin uniquement — protégée par LOCAL_API_KEY si défini)
  app.get("/api/waitlist/export", async (_req, reply) => {
    const entries = await loadEntries();
    const csv =
      "email,plan,source,registeredAt\n" +
      entries
        .map((e) => `${e.email},${e.plan},${e.source},${e.registeredAt}`)
        .join("\n");
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", 'attachment; filename="waitlist.csv"');
    return csv;
  });
}
