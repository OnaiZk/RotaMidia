import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-rethink-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#fff5f0",
          100: "#ffe8dc",
          200: "#ffd1b8",
          300: "#ffb08a",
          400: "#ff824c",
          500: "#ff5000", // Eletromidia Orange
          600: "#e04700",
          700: "#ba3a00",
          800: "#942f00",
          900: "#752600",
          950: "#3d1300",
        },
        eletro: {
          50: "#fff5f0",
          100: "#ffe8dc",
          200: "#ffd1b8",
          300: "#ffb08a",
          400: "#ff824c",
          500: "#ff5000",
          600: "#e04700",
          700: "#ba3a00",
          800: "#942f00",
          900: "#752600",
          950: "#3d1300",
        },
        primary: {
          50: "#fff5f0",
          100: "#ffe8dc",
          200: "#ffd1b8",
          300: "#ffb08a",
          400: "#ff824c",
          500: "#ff5000",
          600: "#e04700",
          700: "#ba3a00",
          800: "#942f00",
          900: "#752600",
          950: "#3d1300",
        },
        navy: {
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        status: {
          pending: "#f59e0b",
          in_progress: "#ff5000",
          completed: "#10b981",
          urgent: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};

export default config;
