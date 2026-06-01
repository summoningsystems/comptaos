import { create } from "zustand";
import { Tab, FileNode } from "../types";

interface AppState {
  // Tabs
  tabs: Tab[];
  activeTabId: string | null;
  openTab: (tab: Tab) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  markDirty: (id: string, dirty: boolean) => void;
  reorderTabs: (fromId: string, toId: string) => void;

  // File tree
  fileTree: FileNode[];
  setFileTree: (tree: FileNode[]) => void;

  // Sidebar
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  tabs: [{ id: "dashboard", title: "Dashboard", type: "dashboard" }],
  activeTabId: "dashboard",

  openTab: (tab) => {
    const existing = get().tabs.find((t) => t.id === tab.id);
    if (!existing) {
      set((s) => ({ tabs: [...s.tabs, tab] }));
    }
    set({ activeTabId: tab.id });
  },

  closeTab: (id) => {
    const tabs = get().tabs.filter((t) => t.id !== id);
    let activeTabId = get().activeTabId;
    if (activeTabId === id) {
      activeTabId = tabs.length > 0 ? tabs[tabs.length - 1].id : null;
    }
    set({ tabs, activeTabId });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  reorderTabs: (fromId, toId) => {
    const tabs = get().tabs;
    const from = tabs.findIndex((t) => t.id === fromId);
    const to = tabs.findIndex((t) => t.id === toId);
    if (from === -1 || to === -1 || from === to) return;
    const next = [...tabs];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    set({ tabs: next });
  },

  markDirty: (id, dirty) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, dirty } : t)),
    }));
  },

  fileTree: [],
  setFileTree: (fileTree) => set({ fileTree }),

  sidebarWidth: 240,
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
}));
