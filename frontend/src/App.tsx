import { useEffect, useState, Component, type ReactNode } from "react";
import axios from "axios";
import { Sidebar } from "./components/Layout/Sidebar";
import { TabBar } from "./components/Layout/TabBar";
import { StatusBar } from "./components/Layout/StatusBar";
import { FileEditor } from "./components/Editor/FileEditor";
import { Dashboard } from "./components/Dashboard/Dashboard";
import { ImportView } from "./components/Import/ImportView";
import { PdfImporter } from "./components/Import/PdfImporter";
import { TransactionsView } from "./components/Transactions/TransactionsView";
import { CopilotPanel } from "./components/Copilot/CopilotPanel";
import { SearchOverlay } from "./components/Search/SearchOverlay";
import { ReportsView } from "./components/Reports/ReportsView";
import { RecurringView } from "./components/Recurring/RecurringView";
import { SettingsView } from "./components/Settings/SettingsView";
import { InvoicesView } from "./components/Invoices/InvoicesView";
import { QuotesView } from "./components/Quotes/QuotesView";
import { TiersView } from "./components/Tiers/TiersView";
import { VatView } from "./components/Vat/VatView";
import { BudgetsView } from "./components/Budgets/BudgetsView";
import { SpreadsheetView } from "./components/Spreadsheet/SpreadsheetView";
import { HistoryView } from "./components/History/HistoryView";
import { JournalView } from "./components/Journal/JournalView";
import { AlertsView } from "./components/Alerts/AlertsView";
import { TemplatesView } from "./components/Templates/TemplatesView";
import { ReconcileView } from "./components/Reconcile/ReconcileView";
import { TreasuryView } from "./components/Treasury/TreasuryView";
import { ExportView } from "./components/Export/ExportView";
import { ProfitLossView } from "./components/ProfitLoss/ProfitLossView";
import { PluginsView } from "./components/Plugins/PluginsView";
import { PricingView } from "./components/Pricing/PricingView";
import { BankingView } from "./components/Banking/BankingView";
import { CommandPalette } from "./components/Layout/CommandPalette";
import { OnboardingWizard } from "./components/Onboarding/OnboardingWizard";
import { useAppStore } from "./stores/appStore";
import { CompanySelector } from "./components/Company/CompanySelector";
import type { TabType } from "./types";

type SidebarSection = "explorer" | "transactions" | "import" | "history";

const TAB_LABELS: Record<TabType, string> = {
  dashboard:    "Dashboard",
  editor:       "Éditeur",
  import:       "Import",
  transactions: "Transactions",
  ocr:          "OCR PDF",
  reports:      "Rapports",
  recurring:    "Frais récurrents",
  invoices:     "Factures",
  quotes:       "Devis",
  settings:     "Paramètres",
  tiers:        "Tiers",
  vat:          "TVA",
  budgets:      "Budgets",
  spreadsheets: "Tableaux",
  history:      "Historique",
  journal:      "Journal",
  alerts:       "Alertes",
  templates:    "Modèles",
  reconcile:    "Rapprochement",
  treasury:     "Trésorerie",
  export:       "Export",
  profitloss:   "Bilan / P&L",
  plugins:      "Plugins",
  pricing:      "Plans & Licence",
  banking:      "Connexion bancaire",
};

// ── ErrorBoundary — empêche les pages blanches sur crash d'un composant ──────
class ViewErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-vscode-muted">
          <span className="text-3xl">⚠️</span>
          <p className="text-sm text-red-400">Erreur dans cette vue</p>
          <p className="text-xs text-vscode-muted max-w-md text-center">{this.state.error}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="text-xs text-vscode-accent hover:underline mt-2"
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Rendu d'une vue par son type (partagé fenêtre principale + popup) */
function ViewContent({ type, tabId, path }: { type: TabType; tabId?: string; path?: string }) {
  return (
    <>
      {type === "dashboard"    && <Dashboard />}
      {type === "editor"       && tabId && path && <FileEditor key={tabId} tabId={tabId} path={path} />}
      {type === "import"       && <ImportView />}
      {type === "ocr"          && <PdfImporter />}
      {type === "transactions" && <TransactionsView />}
      {type === "reports"      && <ReportsView />}
      {type === "recurring"    && <RecurringView />}
      {type === "invoices"     && <InvoicesView />}
      {type === "quotes"       && <QuotesView />}
      {type === "settings"     && <SettingsView />}
      {type === "tiers"        && <TiersView />}
      {type === "vat"          && <VatView />}
      {type === "budgets"      && <BudgetsView />}
      {type === "spreadsheets" && <SpreadsheetView />}
      {type === "history"      && <HistoryView />}
      {type === "journal"      && <JournalView />}
      {type === "alerts"       && <AlertsView />}
      {type === "templates"    && <TemplatesView />}
      {type === "reconcile"    && <ReconcileView />}
      {type === "treasury"     && <TreasuryView />}
      {type === "export"       && <ExportView />}
      {type === "profitloss"   && <ProfitLossView />}
      {type === "plugins"       && <PluginsView />}
      {type === "pricing"       && <PricingView />}
      {type === "banking"       && <BankingView />}
    </>
  );
}

export default function App() {
  // ── Mode fenêtre autonome (?view=<type>) ──────────────────────────────────
  const standaloneView = new URLSearchParams(window.location.search).get("view") as TabType | null;
  if (standaloneView && standaloneView in TAB_LABELS) {
    return (
      <div className="flex flex-col h-screen bg-vscode-bg text-vscode-text">
        <div className="flex items-center justify-between px-3 h-8 bg-vscode-panel border-b border-vscode-border shrink-0 select-none">
          <span className="text-xs text-vscode-muted font-semibold">
            ComptaOS — {TAB_LABELS[standaloneView]}
          </span>
          <button
            onClick={() => window.close()}
            className="text-xs text-vscode-muted hover:text-red-400 transition-colors"
            title="Fermer la fenêtre"
          >✕ Fermer</button>
        </div>
        <div className="flex-1 min-h-0">
          <ViewContent type={standaloneView} />
        </div>
      </div>
    );
  }

  // ── Mode normal ───────────────────────────────────────────────────────────
  const [sidebarSection, setSidebarSection] = useState<SidebarSection>("explorer");
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [showAlertDrop, setShowAlertDrop] = useState(false);
  const [alertMessages, setAlertMessages] = useState<{ level: string; message: string }[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [showCompanyWizard, setShowCompanyWizard] = useState(false);
  const [wizardCanCancel, setWizardCanCancel] = useState(false);
  const { tabs, activeTabId, openTab } = useAppStore();

  useEffect(() => {
    axios.get<{ alerts: { level: string; message: string }[]; count: number }>("/api/alerts")
      .then(({ data }) => { setAlertCount(data.count); setAlertMessages(data.alerts.slice(0, 5)); })
      .catch(() => {});
    axios.get<import("./types").Transaction[]>("/api/transactions")
      .then(({ data }) => setPendingCount(data.filter((t) => t.status === "pending").length))
      .catch(() => {});
    // Ouvrir automatiquement le wizard si aucune entreprise (non annulable)
    import("./api/client").then(({ fetchCompanies }) =>
      fetchCompanies().then((list) => { if (list.length === 0) { setWizardCanCancel(false); setShowCompanyWizard(true); } })
    );
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Raccourci Ctrl+K / Cmd+K → ouvre la recherche globale
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleSectionChange(section: SidebarSection) {
    setSidebarSection(section);
    if (section === "transactions") {
      openTab({ id: "transactions", title: "Transactions", type: "transactions" });
    }
    if (section === "import") {
      openTab({ id: "import", title: "Import CSV", type: "import" });
    }
    if (section === "history") {
      openTab({ id: "history", title: "Historique", type: "history" });
    }
  }

  return (
    <div className="flex flex-col h-screen bg-vscode-bg text-vscode-text">
      {showCompanyWizard && (
        <OnboardingWizard
          onDone={() => { setShowCompanyWizard(false); window.location.reload(); }}
          onCancel={wizardCanCancel ? () => setShowCompanyWizard(false) : undefined}
        />
      )}
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 h-12 bg-vscode-panel border-b border-vscode-border shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span className="text-xs text-vscode-muted font-semibold tracking-wide">ComptaOS</span>
          <CompanySelector onCreateNew={() => { setWizardCanCancel(true); setShowCompanyWizard(true); }} />
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => openTab({ id: "dashboard", title: "Dashboard", type: "dashboard" })}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors"
          >
            Dashboard
          </button>
          <button
            onClick={() => handleSectionChange("import")}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors"
          >
            Import CSV
          </button>
          <button
            onClick={() => openTab({ id: "ocr", title: "OCR PDF", type: "ocr" })}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors"
          >
            OCR PDF
          </button>
          <button
            onClick={() => handleSectionChange("transactions")}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors relative"
          >
            Transactions
            {pendingCount > 0 && (
              <span className="ml-1 px-1 py-0 bg-orange-600 text-white text-[10px] rounded-full align-middle">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => openTab({ id: "tiers", title: "Tiers", type: "tiers" })}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors"
          >
            🏢 Tiers
          </button>
          <button
            onClick={() => openTab({ id: "vat", title: "TVA", type: "vat" })}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors"
          >
            📊 TVA
          </button>
          <button
            onClick={() => openTab({ id: "budgets", title: "Budgets", type: "budgets" })}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors"
          >
            🎯 Budgets
          </button>
          <button
            onClick={() => openTab({ id: "reports", title: "Rapports", type: "reports" })}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors"
          >
            Rapports
          </button>
          <button
            onClick={() => openTab({ id: "recurring", title: "Frais", type: "recurring" })}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors"
          >
            🔄 Frais
          </button>
          <button
            onClick={() => openTab({ id: "invoices", title: "Factures", type: "invoices" })}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors"
          >
            🧾 Factures
          </button>
          <button
            onClick={() => openTab({ id: "quotes", title: "Devis", type: "quotes" })}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors"
          >
            📋 Devis
          </button>
          <button
            onClick={() => openTab({ id: "spreadsheets", title: "Tableaux", type: "spreadsheets" })}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors"
          >
            🧮 Tableaux
          </button>
          <button
            onClick={() => openTab({ id: "journal", title: "Journal", type: "journal" })}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors"
          >
            📒 Journal
          </button>
          <button
            onClick={() => openTab({ id: "reconcile", title: "Rapprochement", type: "reconcile" })}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors"
          >
            🔗 Rapprochement
          </button>
          <button
            onClick={() => openTab({ id: "banking", title: "Connexion bancaire", type: "banking" })}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors"
          >
            🏦 Banque PSD2
          </button>
          <button
            onClick={() => openTab({ id: "templates", title: "Modèles", type: "templates" })}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors"
          >
            📋 Modèles
          </button>
          <button
            onClick={() => openTab({ id: "treasury", title: "Trésorerie", type: "treasury" })}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors"
          >
            💰 Trésorerie
          </button>
          <button
            onClick={() => openTab({ id: "profitloss", title: "Bilan / P&L", type: "profitloss" })}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors"
          >
            📈 Bilan / P&L
          </button>
          <button
            onClick={() => openTab({ id: "export", title: "Export", type: "export" })}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors"
          >
            ⬇ Export
          </button>
          <button
            onClick={() => openTab({ id: "settings", title: "Paramètres", type: "settings" })}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors"
          >
            ⚙️ Paramètres
          </button>
          <button
            onClick={() => openTab({ id: "plugins", title: "Plugins", type: "plugins" })}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors"
          >
            🧩 Plugins
          </button>
          <button
            onClick={() => openTab({ id: "pricing", title: "Plans & Licence", type: "pricing" })}
            className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors font-semibold border border-yellow-700/50 rounded px-2 py-0.5"
          >
            ⭐ Plans
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            className="text-xs text-vscode-muted hover:text-vscode-text transition-colors border border-vscode-border rounded px-2 py-0.5"
            title="Recherche globale (Ctrl+K)"
          >
            🔍 Ctrl+K
          </button>
          {/* Bell alertes */}
          <div className="relative">
            <button
              onClick={() => { setShowAlertDrop((o) => !o); }}
              className="text-xs text-vscode-muted hover:text-vscode-text transition-colors relative"
              title="Alertes"
            >
              🔔
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                  {alertCount > 9 ? "9+" : alertCount}
                </span>
              )}
            </button>
            {showAlertDrop && alertMessages.length > 0 && (
              <div className="absolute right-0 top-6 z-50 w-80 bg-vscode-panel border border-vscode-border rounded-lg shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-vscode-border">
                  <span className="text-[11px] font-semibold text-vscode-text">Alertes ({alertCount})</span>
                  <button onClick={() => { openTab({ id: "alerts", title: "Alertes", type: "alerts" }); setShowAlertDrop(false); }} className="text-[10px] text-vscode-accent hover:underline">Tout voir →</button>
                </div>
                {alertMessages.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 border-b border-vscode-border/50 text-[11px]">
                    <span>{a.level === "error" ? "🔴" : a.level === "warn" ? "🟡" : "🔵"}</span>
                    <span className="text-vscode-text">{a.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setCopilotOpen((o) => !o)}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${copilotOpen ? "bg-purple-700 text-white" : "text-purple-400 hover:text-purple-300"}`}
          >
            ✨ Copilote
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        <Sidebar activeSection={sidebarSection} onSectionChange={handleSectionChange} />

        <div className="flex flex-col flex-1 min-w-0">
          <TabBar />

          <div className="flex-1 min-h-0">
            <ViewErrorBoundary key={activeTab?.id ?? "empty"}>
              {activeTab
                ? <ViewContent type={activeTab.type} tabId={activeTab.id} path={(activeTab as { path?: string }).path} />
                : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-vscode-muted select-none">
                    <span className="text-4xl">📊</span>
                    <span className="text-sm">Bienvenue dans ComptaOS</span>
                    <span className="text-xs">Ouvrez un fichier ou naviguez dans le workspace</span>
                  </div>
                )
              }
            </ViewErrorBoundary>
          </div>
        </div>
      </div>

      <StatusBar />
      <CommandPalette />
      <CopilotPanel open={copilotOpen} onClose={() => setCopilotOpen(false)} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
