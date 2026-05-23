import { FastifyInstance } from "fastify";
import { buildFileTree, readFile, writeFile, deleteFile, createDirectory, renameNode } from "../services/fileSystem.js";

export async function filesRoutes(app: FastifyInstance) {
  // GET /api/files — arbre complet du workspace
  app.get("/", async (_req, reply) => {
    const tree = await buildFileTree(await import("../services/fileSystem.js").then((m) => m.getWorkspaceRoot()));
    return reply.send(tree);
  });

  // GET /api/files/content?path=transactions/txn_001.yaml
  app.get<{ Querystring: { path: string } }>("/content", async (req, reply) => {
    const { path } = req.query;
    if (!path) return reply.status(400).send({ error: "path requis" });
    const content = await readFile(path);
    return reply.send({ content });
  });

  // PUT /api/files/content — sauvegarde un fichier
  app.put<{ Body: { path: string; content: string } }>("/content", async (req, reply) => {
    const { path, content } = req.body;
    if (!path || content === undefined) return reply.status(400).send({ error: "path et content requis" });
    await writeFile(path, content);
    return reply.send({ ok: true });
  });

  // DELETE /api/files?path=...
  app.delete<{ Querystring: { path: string } }>("/", async (req, reply) => {
    const { path } = req.query;
    if (!path) return reply.status(400).send({ error: "path requis" });
    await deleteFile(path);
    return reply.send({ ok: true });
  });

  // POST /api/files/directory
  app.post<{ Body: { path: string } }>("/directory", async (req, reply) => {
    const { path } = req.body;
    if (!path) return reply.status(400).send({ error: "path requis" });
    await createDirectory(path);
    return reply.send({ ok: true });
  });

  // POST /api/files/rename
  app.post<{ Body: { oldPath: string; newPath: string } }>("/rename", async (req, reply) => {
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) return reply.status(400).send({ error: "oldPath et newPath requis" });
    await renameNode(oldPath, newPath);
    return reply.send({ ok: true });
  });
}
