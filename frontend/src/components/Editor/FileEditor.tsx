import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { fetchFileContent, saveFileContent } from "../../api/client";
import { useAppStore } from "../../stores/appStore";

interface FileEditorProps {
  tabId: string;
  path: string;
}

function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    yaml: "yaml",
    yml: "yaml",
    json: "json",
    md: "markdown",
    ts: "typescript",
    js: "javascript",
    csv: "plaintext",
  };
  return map[ext] ?? "plaintext";
}

export function FileEditor({ tabId, path }: FileEditorProps) {
  const { markDirty } = useAppStore();
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const originalRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchFileContent(path)
      .then((text) => {
        if (cancelled) return;
        setContent(text);
        originalRef.current = text;
        markDirty(tabId, false);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de lire le fichier");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [path]);

  function handleChange(value: string | undefined) {
    const v = value ?? "";
    setContent(v);
    markDirty(tabId, v !== originalRef.current);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveFileContent(path, content);
      originalRef.current = content;
      markDirty(tabId, false);
    } catch {
      setError("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  // Ctrl+S / Cmd+S
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [content]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-vscode-muted text-sm">
        Chargement…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1 bg-vscode-panel border-b border-vscode-border shrink-0">
        <span className="text-vscode-muted text-xs truncate">{path}</span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs bg-vscode-accent hover:bg-blue-600 disabled:opacity-50 text-white px-2 py-0.5 rounded transition-colors"
        >
          {saving ? "Sauvegarde…" : "Sauvegarder"}
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={detectLanguage(path)}
          value={content}
          onChange={handleChange}
          theme="vs-dark"
          options={{
            fontSize: 13,
            fontFamily: "JetBrains Mono, Consolas, monospace",
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            tabSize: 2,
            renderWhitespace: "selection",
            bracketPairColorization: { enabled: true },
          }}
        />
      </div>
    </div>
  );
}
