/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,ts}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--vscode-editor-background, #0b0c10)",             // Dynamic VS Code editor background with fallback
        surface: "var(--vscode-sideBar-background, #16181d)",        // Dynamic VS Code sidebar surface
        surfaceHover: "var(--vscode-list-hoverBackground, #21242c)", // Dynamic VS Code list hover state
        accent: "var(--vscode-button-background, #3b82f6)",         // Dynamic VS Code primary button accent
        accentLight: "var(--vscode-button-hoverBackground, #1e293b)",// Dynamic VS Code secondary highlight
        textPrimary: "var(--vscode-editor-foreground, #f3f4f6)",    // Dynamic VS Code text foreground
        textSecondary: "var(--vscode-descriptionForeground, #9ca3af)",// Dynamic VS Code secondary/muted text
        borderMuted: "var(--vscode-panel-border, #2a2c35)",         // Dynamic VS Code panel border
      },
      borderRadius: {
        xl: "4px",
      },
    },
  },
  plugins: [],
};
