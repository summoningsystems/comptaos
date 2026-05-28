/**
 * ComptaOS — Electron main process (CommonJS)
 * Démarre le backend Fastify puis ouvre la fenêtre principale.
 */

const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const net = require("net");
const fs = require("fs");

let backendPort = 3001;
let backendUrl  = `http://127.0.0.1:${backendPort}`;

let backendProcess = null;
let mainWindow     = null;
let backendExited  = false;
let backendExitCode = null;
const backendLogLines = [];

function pushBackendLog(line) {
  backendLogLines.push(line);
  // Garder uniquement les dernières lignes pour éviter une boîte de dialogue géante
  if (backendLogLines.length > 40) backendLogLines.shift();
}

function getBackendLogTail() {
  return backendLogLines.slice(-12).join("\n");
}

function findFreePort(preferred) {
  return new Promise((resolve, reject) => {
    const tester = net.createServer();
    tester.once("error", () => {
      // Port préféré occupé, demander un port libre au système
      const auto = net.createServer();
      auto.once("error", reject);
      auto.listen(0, "127.0.0.1", () => {
        const address = auto.address();
        const chosen = typeof address === "object" && address ? address.port : preferred;
        auto.close(() => resolve(chosen));
      });
    });
    tester.listen(preferred, "127.0.0.1", () => {
      tester.close(() => resolve(preferred));
    });
  });
}

function resolveBackendPaths() {
  if (app.isPackaged) {
    // En build installée, les assets sont copiés dans resources/
    const backendDir = path.join(process.resourcesPath, "backend");
    return {
      backendDir,
      entryScript: path.join(backendDir, "dist", "index.js"),
    };
  }

  // En dev, on lance depuis le repo
  const backendDir = path.join(__dirname, "..", "backend");
  return {
    backendDir,
    entryScript: path.join(backendDir, "dist", "index.js"),
  };
}

// ── Démarre le backend Node ────────────────────────────────────────────────
function startBackend() {
  const { backendDir, entryScript } = resolveBackendPaths();

  if (!fs.existsSync(entryScript)) {
    throw new Error(`Backend introuvable: ${entryScript}`);
  }

  backendExited = false;
  backendExitCode = null;
  pushBackendLog(`[main] backendDir=${backendDir}`);
  pushBackendLog(`[main] entryScript=${entryScript}`);
  pushBackendLog(`[main] backendPort=${backendPort}`);

  backendProcess = spawn(process.execPath, [entryScript], {
    cwd: backendDir,
    env: {
      ...process.env,
      // Permet d'exécuter Electron comme runtime Node dans le process enfant
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(backendPort),
      WORKSPACE_PATH: path.join(app.getPath("userData"), "workspace"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (d) => {
    const s = String(d);
    pushBackendLog(`[stdout] ${s.trim()}`);
    process.stdout.write(`[backend] ${s}`);
  });
  backendProcess.stderr.on("data", (d) => {
    const s = String(d);
    pushBackendLog(`[stderr] ${s.trim()}`);
    process.stderr.write(`[backend] ${s}`);
  });

  backendProcess.on("exit", (code, signal) => {
    backendExited = true;
    backendExitCode = code;
    pushBackendLog(`[exit] code=${code} signal=${signal}`);
    if (code !== 0 && code !== null) {
      console.error(`[backend] processus terminé avec le code ${code}`);
    }
  });

  backendProcess.on("error", (err) => {
    console.error("[backend] échec de démarrage:", err);
    dialog.showErrorBox("Erreur backend", String(err));
  });
}

// ── Sonde /api/health jusqu'à ce que le backend réponde ───────────────────
function waitForBackend(retries = 40, delayMs = 500) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      if (backendExited) {
        const tail = getBackendLogTail();
        return reject(new Error(`Backend arrêté prématurément (code=${backendExitCode})\n\n${tail}`));
      }

      http.get(`${backendUrl}/api/health`, (res) => {
        if (res.statusCode === 200) return resolve();
        retry(n);
      }).on("error", () => retry(n));
    };
    const retry = (n) => {
      if (n <= 0) {
        const tail = getBackendLogTail();
        return reject(new Error(`Backend injoignable après ${retries} tentatives\nURL: ${backendUrl}/api/health\n\nDerniers logs:\n${tail}`));
      }
      setTimeout(() => attempt(n - 1), delayMs);
    };
    attempt(retries);
  });
}

// ── Crée la BrowserWindow ──────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    title: "ComptaOS",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(backendUrl);
  mainWindow.on("closed", () => { mainWindow = null; });
}

// ── Cycle de vie de l'app ──────────────────────────────────────────────────
app.whenReady().then(async () => {
  backendPort = await findFreePort(3001);
  backendUrl = `http://127.0.0.1:${backendPort}`;

  startBackend();

  try {
    await waitForBackend();
  } catch (err) {
    dialog.showErrorBox("Erreur de démarrage", String(err));
    app.quit();
    return;
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});
