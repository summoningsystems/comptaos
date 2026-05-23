import { FastifyInstance } from "fastify";
import { getLog, getDiff, hasRepo } from "../services/gitService.js";
import { getWorkspaceRoot } from "../services/fileSystem.js";

export async function gitRoutes(app: FastifyInstance) {
  /**
   * GET /api/git/log
   * Retourne les N derniers commits du workspace actif.
   */
  app.get<{ Querystring: { n?: string } }>("/log", async (req, reply) => {
    const root = getWorkspaceRoot();
    const ok = await hasRepo(root);
    if (!ok) return reply.send({ commits: [], initialized: false });
    const n = Math.min(parseInt(req.query.n ?? "100", 10), 500);
    const commits = await getLog(root, n);
    return reply.send({ commits, initialized: true });
  });

  /**
   * GET /api/git/diff/:hash
   * Retourne le diff complet d'un commit.
   */
  app.get<{ Params: { hash: string } }>("/diff/:hash", async (req, reply) => {
    const { hash } = req.params;
    if (!/^[0-9a-f]{4,64}$/i.test(hash)) {
      return reply.status(400).send({ error: "hash invalide" });
    }
    const diff = await getDiff(getWorkspaceRoot(), hash);
    return reply.send({ diff });
  });
}
