import { useAppStore } from "../../stores/appStore";
import { FileTree } from "../Explorer/FileTree";

type SidebarSection = "explorer" | "transactions" | "import" | "history";

interface SidebarProps {
  activeSection: SidebarSection;
  onSectionChange: (s: SidebarSection) => void;
}

const NAV_ITEMS: { id: SidebarSection; icon: string; title: string }[] = [
  { id: "explorer",     icon: "📁", title: "Explorer" },
  { id: "transactions", icon: "📋", title: "Transactions" },
  { id: "import",       icon: "📥", title: "Import CSV" },
  { id: "history",      icon: "🕐", title: "Historique Git" },
];

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const { sidebarWidth } = useAppStore();

  return (
    <div
      className="flex shrink-0 border-r border-vscode-border bg-vscode-sidebar"
      style={{ width: sidebarWidth }}
    >
      {/* Activity bar */}
      <div className="flex flex-col items-center py-2 gap-1 w-10 bg-vscode-panel border-r border-vscode-border shrink-0">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            title={item.title}
            onClick={() => onSectionChange(item.id)}
            className={`
              w-8 h-8 flex items-center justify-center rounded text-base transition-colors
              ${activeSection === item.id
                ? "text-white bg-vscode-highlight"
                : "text-vscode-muted hover:text-vscode-text"
              }
            `}
          >
            {item.icon}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {activeSection === "explorer" && <FileTree />}
        {activeSection === "transactions" && (
          <div className="text-vscode-muted text-xs p-3">
            Ouvrez l'onglet Transactions via le menu principal.
          </div>
        )}
        {activeSection === "import" && (
          <div className="text-vscode-muted text-xs p-3">
            Ouvrez l'onglet Import CSV via le menu principal.
          </div>
        )}
        {activeSection === "history" && (
          <div className="text-vscode-muted text-xs p-3">
            Ouvrez l'onglet Historique via le menu principal.
          </div>
        )}
      </div>
    </div>
  );
}
