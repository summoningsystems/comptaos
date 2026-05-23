/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Palette pilotée par CSS variables — toggle dark/light sans modifier le JSX
        vscode: {
          bg:           "var(--vscode-bg)",
          sidebar:      "var(--vscode-sidebar)",
          panel:        "var(--vscode-panel)",
          border:       "var(--vscode-border)",
          accent:       "var(--vscode-accent)",
          text:         "var(--vscode-text)",
          muted:        "var(--vscode-muted)",
          highlight:    "var(--vscode-highlight)",
          tab:          "var(--vscode-tab)",
          "tab-active": "var(--vscode-tab-active)",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
