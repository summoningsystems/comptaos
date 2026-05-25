/**
 * encryptionService.ts
 * Chiffrement AES-256-GCM du workspace ComptaOS.
 *
 * La clé de chiffrement est dérivée d'une phrase secrète via PBKDF2.
 * Les métadonnées (sel + statut) sont stockées dans <workspace>/.encryption.json.
 * Le fichier .encryption.json doit être ajouté au .gitignore si la passphrase est sensible.
 *
 * Fonctionnement :
 *   - encrypt(plaintext, passphrase) → "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 *   - decrypt(ciphertext, passphrase) → plaintext
 *   - Le contenu des fichiers .yaml/.json dans le workspace peut être chiffré à la demande.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  pbkdf2Sync,
  createHash,
} from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getWorkspaceRoot } from "./fileSystem.js";

const ALGORITHM   = "aes-256-gcm";
const KEY_LENGTH  = 32;   // 256 bits
const PBKDF2_ITER = 100_000;
const SALT_LENGTH = 32;

export interface EncryptionMeta {
  enabled: boolean;
  saltHex: string;       // sel PBKDF2 en hex
  passphraseHash: string; // SHA-256 de la passphrase (vérification seulement)
  encryptedAt?: string;
}

function getMetaPath(): string {
  return join(getWorkspaceRoot(), ".encryption.json");
}

export function loadEncryptionMeta(): EncryptionMeta | null {
  const p = getMetaPath();
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as EncryptionMeta;
  } catch {
    return null;
  }
}

function saveEncryptionMeta(meta: EncryptionMeta): void {
  writeFileSync(getMetaPath(), JSON.stringify(meta, null, 2), "utf-8");
}

function deriveKey(passphrase: string, saltHex: string): Buffer {
  const salt = Buffer.from(saltHex, "hex");
  return pbkdf2Sync(passphrase, salt, PBKDF2_ITER, KEY_LENGTH, "sha256");
}

function hashPassphrase(passphrase: string): string {
  return createHash("sha256").update(passphrase).digest("hex");
}

/** Active le chiffrement pour ce workspace avec la passphrase donnée. */
export function enableEncryption(passphrase: string): EncryptionMeta {
  if (!passphrase || passphrase.length < 8) {
    throw new Error("La passphrase doit comporter au moins 8 caractères");
  }
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const meta: EncryptionMeta = {
    enabled: true,
    saltHex: salt,
    passphraseHash: hashPassphrase(passphrase),
    encryptedAt: new Date().toISOString(),
  };
  saveEncryptionMeta(meta);
  return meta;
}

/** Désactive le chiffrement (ne déchiffre pas les fichiers existants). */
export function disableEncryption(): void {
  const p = getMetaPath();
  if (!existsSync(p)) return;
  const meta = loadEncryptionMeta();
  if (!meta) return;
  meta.enabled = false;
  saveEncryptionMeta(meta);
}

/** Vérifie que la passphrase correspond au hash stocké. */
export function verifyPassphrase(passphrase: string): boolean {
  const meta = loadEncryptionMeta();
  if (!meta) return false;
  return meta.passphraseHash === hashPassphrase(passphrase);
}

/**
 * Chiffre une chaîne en AES-256-GCM.
 * Retourne une chaîne "<iv>:<authTag>:<ciphertext>" en hex.
 */
export function encrypt(plaintext: string, passphrase: string, saltHex: string): string {
  const key = deriveKey(passphrase, saltHex);
  const iv  = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(plaintext, "utf-8")),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Déchiffre une chaîne produite par `encrypt`.
 * Retourne le texte clair, ou lève une erreur si la passphrase est incorrecte.
 */
export function decrypt(ciphertext: string, passphrase: string, saltHex: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Format de données chiffrées invalide");

  const [ivHex, authTagHex, dataHex] = parts;
  const key     = deriveKey(passphrase, saltHex);
  const iv      = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const data    = Buffer.from(dataHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf-8");
}

/** Vérifie si une chaîne est au format chiffré ComptaOS. */
export function isEncrypted(value: string): boolean {
  return /^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/.test(value.trim());
}
