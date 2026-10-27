/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Semantic Token Mapping (CSS Variables)
        app: {
          bg: "var(--color-app-bg)",
          surface: "var(--color-surface)",
          raised: "var(--color-surface-raised)",
          border: "var(--color-border-subtle)",
        },
        content: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
        },
        icon: {
          bg: "var(--color-icon-bg)",
          fg: "var(--color-icon-fg)",
        },

        // Explicit Light & Dark Surface Hex Codes from docs/ScribeX-Pastel-Tile-UI-Design-System.md
        light: {
          appBg: "#E8ECF5",
          surface: "#FFFFFF",
          raised: "#FFFFFF",
          textPrimary: "#171717",
          textSecondary: "#626262",
          textMuted: "#929292",
          border: "#E8E8E8",
          iconBg: "#111111",
          iconFg: "#FFFFFF",
        },
        dark: {
          appBg: "#242424",
          surface: "#242424",
          raised: "#303030",
          textPrimary: "#F7F7F7",
          textSecondary: "#B5B5B5",
          textMuted: "#858585",
          border: "#3A3A3A",
          iconBg: "#383838",
          iconFg: "#FFFFFF",
        },

        // Vivid Pastel Note Tiles (Identical across Light & Dark Modes)
        note: {
          apricot: "#FFC96F",
          coral: "#FF9277",
          lime: "#E5F28B",
          lavender: "#B18AF3",
          cyan: "#08C4E5",
          pink: "#F5A4C6",
          sky: "#8EDCEB",
          text: "#191919",
        },

        // Special Actions
        favorite: "#FFD43B",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        'workspace': '24px',
      }
    }
  },
  plugins: []
};
