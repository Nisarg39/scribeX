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
        // Pastel Note Tile Accents
        note: {
          apricot: "#FFC96F",
          coral: "#FF9277",
          lime: "#E5F28B",
          lavender: "#B18AF3",
          cyan: "#08C4E5",
          pink: "#F5A4C6",
          sky: "#8EDCEB"
        },
        // Core Theme Surfaces
        brand: {
          canvas: "#0C0E14",
          surface: "#141722",
          elevated: "#1A1E2E",
          subtle: "#20263A"
        },
        light: {
          canvas: "#E8ECF5",
          surface: "#FFFFFF",
          elevated: "#F4F6FB",
          subtle: "#E2E7F2"
        }
      }
    }
  },
  plugins: []
};
