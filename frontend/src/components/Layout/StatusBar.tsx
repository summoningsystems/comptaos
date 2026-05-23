import { useAppStore } from "../../stores/appStore";
import { useTheme } from "../../hooks/useTheme";

export function StatusBar() {
  const { tabs, activeTabId } = useAppStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const { theme, toggle } = useTheme();

  return (
    <div className="flex items-center justify-between px-3 h-6 bg-vscode-accent text-white text-xs shrink-0 select-none">
      <div className="flex items-center gap-3">
        <span className="font-semibold">ComptaOS</span>
        {activeTab?.path && (
          <span className="text-blue-100 opacity-80">{activeTab.path}</span>
        )}
      </div>
      <div className="flex items-center gap-3 opacity-80">
        <button
          onClick={toggle}
          title={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
          className="hover:opacity-100 transition-opacity cursor-pointer"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
        <span>UTF-8</span>
        <span>YAML</span>
      </div>
    </div>
  );
}
