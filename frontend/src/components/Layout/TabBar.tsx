import { useRef, useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { Tab } from "../../types";

const TAB_ICONS: Record<string, string> = {
  dashboard:    "⬛",
  editor:       "📄",
  import:       "📥",
  transactions: "📋",
  ocr:          "🔍",
  reports:      "📊",
  recurring:    "🔄",
  invoices:     "🧾",
  quotes:       "📋",
  plugins:      "🧩",
  pricing:      "⭐",
  banking:      "🏦",
  settings:     "⚙️",
  tiers:        "🏢",
  vat:          "💰",
  budgets:      "🎯",
  spreadsheets: "🧭",
  history:      "🕐",
};

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, reorderTabs } = useAppStore();
  const dragIdRef = useRef<string | null>(null);
  const dragCountersRef = useRef<Record<string, number>>({});
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function popOut(tab: Tab) {
    const url = `${window.location.origin}${window.location.pathname}?view=${tab.type}`;
    window.open(url, `comptaos_${tab.type}`, "popup,width=1400,height=900");
  }

  return (
    <div className="flex items-end bg-vscode-panel border-b border-vscode-border overflow-x-auto shrink-0 h-9">
      {tabs.map((tab: Tab) => (
        <div
          key={tab.id}
          draggable
          onClick={() => setActiveTab(tab.id)}
          onMouseDown={(e) => {
            if (e.button === 1) {
              e.preventDefault();
              e.stopPropagation();
              closeTab(tab.id);
            }
          }}
          onDragStart={(e) => {
            dragIdRef.current = tab.id;
            dragCountersRef.current = {};
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (dragIdRef.current !== tab.id) setDragOverId(tab.id);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            dragCountersRef.current[tab.id] = (dragCountersRef.current[tab.id] ?? 0) + 1;
            if (dragIdRef.current !== tab.id) setDragOverId(tab.id);
          }}
          onDragLeave={() => {
            dragCountersRef.current[tab.id] = (dragCountersRef.current[tab.id] ?? 1) - 1;
            if (dragCountersRef.current[tab.id] <= 0) {
              dragCountersRef.current[tab.id] = 0;
              setDragOverId((prev) => (prev === tab.id ? null : prev));
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragIdRef.current && dragIdRef.current !== tab.id) {
              reorderTabs(dragIdRef.current, tab.id);
            }
            dragIdRef.current = null;
            dragCountersRef.current = {};
            setDragOverId(null);
          }}
          onDragEnd={() => {
            dragIdRef.current = null;
            dragCountersRef.current = {};
            setDragOverId(null);
          }}
          className={`
            group flex items-center gap-1.5 px-3 h-full text-xs border-r border-vscode-border cursor-pointer select-none whitespace-nowrap min-w-0 max-w-[200px]
            ${activeTabId === tab.id
              ? "bg-vscode-bg text-vscode-text border-t border-t-vscode-accent"
              : "bg-vscode-panel text-vscode-muted hover:text-vscode-text"
            }
            ${dragOverId === tab.id ? "border-l-2 border-l-vscode-accent" : ""}
          `}
        >
          <span className="shrink-0 text-[10px]">{TAB_ICONS[tab.type] ?? "📄"}</span>
          <span className="truncate">{tab.title}</span>
          {tab.dirty && <span className="text-yellow-400 text-[8px]">●</span>}
          {/* Popout : ouvre dans une fenêtre séparée */}
          <button
            onClick={(e) => { e.stopPropagation(); popOut(tab); }}
            className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-vscode-accent text-vscode-muted rounded px-0.5 shrink-0 text-[10px]"
            title="Ouvrir dans une fenêtre séparée"
          >↵</button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
            className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-white text-vscode-muted rounded px-0.5 shrink-0"
            title="Fermer"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
