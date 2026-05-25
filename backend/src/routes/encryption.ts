import { FastifyInstance } from "fastify";
import {
  loadEncryptionMeta,
  enableEncryption,
  disableEncryption,
  verifyPassphrase,
  encrypt,
  decrypt,
} from "../services/encryptionService.js";

export async function encryptionRoutes(app: FastifyInstance) {
  /** GET /api/encryption/status */
  app.get("/status", async (_req, reply) => {
    const meta = loadEncryptionMeta();
    return reply.send({
      enabled: meta?.enabled ?? false,
      encryptedAt: meta?.encryptedAt ?? null,
    });
  });

  /** POST /api/encryption/enable — active le chiffrement */
  app.post<{ Body: { passphrase: string } }>("/enable", async (req, reply) => {
    const { passphrase } = req.body;
    if (!passphrase) return reply.status(400).send({ error: "passphrase requise" });
    try {
      const meta = enableEncryption(passphrase);
      return reply.send({ ok: true, encryptedAt: meta.encryptedAt });
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message });
    }
  });

  /** POST /api/encryption/disable — désactive le chiffrement */
  app.post<{ Body: { passphrase: string } }>("/disable", async (req, reply) => {
    const { passphrase } = req.body;
    if (!verifyPassphrase(passphrase ?? "")) {
      return reply.status(401).send({ error: "Passphrase incorrecte" });
    }
    disableEncryption();
    return reply.send({ ok: true });
  });

  /** POST /api/encryption/verify — vérifie la passphrase */
  app.post<{ Body: { passphrase: string } }>("/verify", async (req, reply) => {
    const ok = verifyPassphrase(req.body.passphrase ?? "");
    return reply.send({ ok });
  });

  /** POST /api/encryption/encrypt — chiffre un texte arbitraire */
  app.post<{ Body: { plaintext: string; passphrase: string } }>("/encrypt", async (req, reply) => {
    const { plaintext, passphrase } = req.body;
    if (!plaintext || !passphrase) return reply.status(400).send({ error: "plaintext et passphrase requis" });
    const meta = loadEncryptionMeta();
    if (!meta?.enabled) return reply.status(400).send({ error: "Chiffrement non activé" });
    const result = encrypt(plaintext, passphrase, meta.saltHex);
    return reply.send({ result });
  });

  /** POST /api/encryption/decrypt — déchiffre un texte */
  app.post<{ Body: { ciphertext: string; passphrase: string } }>("/decrypt", async (req, reply) => {
    const { ciphertext, passphrase } = req.body;
    if (!ciphertext || !passphrase) return reply.status(400).send({ error: "ciphertext et passphrase requis" });
    const meta = loadEncryptionMeta();
    if (!meta) return reply.status(400).send({ error: "Chiffrement non configuré" });
    try {
      const result = decrypt(ciphertext, passphrase, meta.saltHex);
      return reply.send({ result });
    } catch {
      return reply.status(401).send({ error: "Déchiffrement impossible — passphrase incorrecte" });
    }
  });
}
