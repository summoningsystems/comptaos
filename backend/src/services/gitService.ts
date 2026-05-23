import { execFile as _execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";

const execFile = promisify(_execFile);

/** Lance une commande git dans un répertoire donné. */
async function git(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await execFile("git", args, { cwd });
    return stdout.trim();
  } catch (err: unknown) {
    const e = err as { stderr?: string; message?: string };
    throw new Error(e.stderr?.trim() || e.message || String(err));
  }
}

/**
 * Initialise un dépôt Git dans le dossier workspace si ce n'est pas déjà fait.
 * Crée un .gitignore (exclut les pièces jointes) et fait un commit initial.
 */
export async function initRepo(workspacePath: string): Promise<void> {
  try {
    await git(["rev-parse", "--git-dir"], workspacePath);
    // Déjà initialisé — s'assurer que l'identité est configurée
    await git(["config", "user.email", "comptaos@localhost"], workspacePath).catch(() => {});
    await git(["config", "user.name", "ComptaOS"], workspacePath).catch(() => {});
  } catch {
    // Nouveau dépôt
    await git(["init"], workspacePath);
    await git(["config", "user.email", "comptaos@localhost"], workspacePath);
    await git(["config", "user.name", "ComptaOS"], workspacePath);

    const gitignore = "attachments/\n*.tmp\n.DS_Store\n";
    await fs.writeFile(path.join(workspacePath, ".gitignore"), gitignore, "utf-8");

    try {
      await git(["add", "-A"], workspacePath);
      await git(["commit", "-m", "init: initialisation du workspace ComptaOS"], workspacePath);
    } catch {
      // Le dossier peut être vide — on ignore
    }
  }
}

/**
 * Ajoute tous les fichiers modifiés et crée un commit.
 * Ne plante jamais (les erreurs git ne doivent pas bloquer l'API).
 */
export async function autoCommit(workspacePath: string, message: string): Promise<void> {
  try {
    await git(["add", "-A"], workspacePath);
    const status = await git(["status", "--porcelain"], workspacePath);
    if (!status) return; // Rien à commiter
    await git(["commit", "-m", message], workspacePath);
  } catch (err) {
    console.warn("[git] autoCommit ignoré:", (err as Error).message?.slice(0, 120));
  }
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  date: string;
  message: string;
  author: string;
  filesChanged: number;
}

const SEP = "\x1f"; // Unit Separator ASCII — impossible dans un message de commit standard

/** Retourne les N derniers commits du dépôt. */
export async function getLog(workspacePath: string, n = 100): Promise<GitCommit[]> {
  try {
    const format = `%H${SEP}%h${SEP}%ai${SEP}%s${SEP}%an`;
    const out = await git(["log", `--pretty=format:${format}`, "-n", String(n)], workspacePath);
    if (!out) return [];

    // Récupérer le nombre de fichiers changés par commit (--shortstat)
    const statOut = await git(
      ["log", "--pretty=format:%H", "--shortstat", "-n", String(n)],
      workspacePath
    );
    const statMap: Record<string, number> = {};
    const statLines = statOut.split("\n");
    let currentHash = "";
    for (const line of statLines) {
      if (/^[0-9a-f]{40}$/i.test(line.trim())) {
        currentHash = line.trim();
      } else {
        const m = line.match(/(\d+) file/);
        if (m && currentHash) {
          statMap[currentHash] = parseInt(m[1], 10);
        }
      }
    }

    return out
      .split("\n")
      .map((line) => {
        const parts = line.split(SEP);
        const hash = parts[0] ?? "";
        return {
          hash,
          shortHash: parts[1] ?? "",
          date: parts[2] ?? "",
          message: parts[3] ?? "",
          author: parts[4] ?? "",
          filesChanged: statMap[hash] ?? 0,
        };
      })
      .filter((c) => c.hash);
  } catch {
    return [];
  }
}

/** Retourne le diff complet (stat + patch) d'un commit. */
export async function getDiff(workspacePath: string, hash: string): Promise<string> {
  if (!/^[0-9a-f]{4,64}$/i.test(hash)) throw new Error("hash invalide");
  try {
    return await git(["show", hash, "--stat", "--patch", "--no-color"], workspacePath);
  } catch {
    return "";
  }
}

/** Retourne true si le workspace est un dépôt git valide avec au moins un commit. */
export async function hasRepo(workspacePath: string): Promise<boolean> {
  try {
    await git(["rev-parse", "HEAD"], workspacePath);
    return true;
  } catch {
    return false;
  }
}
