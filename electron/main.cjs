/**
 * ComptaOS — Electron main process (CommonJS)
 * Démarre le backend Fastify puis ouvre la fenêtre principale.
 */

const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

const BACKEND_PORT = 3001;
const BACKEND_URL  = `http://127.0.0.1:${BACKEND_PORT}`;

let backendProcess = null;
let mainWindow     = null;

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

  if (!require("fs").existsSync(entryScript)) {
    throw new Error(`Backend introuvable: ${entryScript}`);
  }

  backendProcess = spawn(process.execPath, [entryScript], {
    cwd: backendDir,
    env: {
      ...process.env,
      // Permet d'exécuter Electron comme runtime Node dans le process enfant
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(BACKEND_PORT),
      WORKSPACE_PATH: path.join(app.getPath("userData"), "workspace"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (d) => process.stdout.write(`[backend] ${d}`));
  backendProcess.stderr.on("data", (d) => process.stderr.write(`[backend] ${d}`));

  backendProcess.on("exit", (code) => {
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
      http.get(`${BACKEND_URL}/api/health`, (res) => {
        if (res.statusCode === 200) return resolve();
        retry(n);
      }).on("error", () => retry(n));
    };
    const retry = (n) => {
      if (n <= 0) return reject(new Error("Backend injoignable après 40 tentatives"));
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

  mainWindow.loadURL(BACKEND_URL);
  mainWindow.on("closed", () => { mainWindow = null; });
}

// ── Cycle de vie de l'app ──────────────────────────────────────────────────
app.whenReady().then(async () => {
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
