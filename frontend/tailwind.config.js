/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Luxury dark mode palette
        ink: {
          950: "#070a12",
          900: "#0b0f1a",
          850: "#0f1422",
          800: "#141a2b",
          700: "#1c2438",
          600: "#27314a",
          500: "#3a4768",
        },
        gold: {
          400: "#e8c87a",
          500: "#d4af5f",
          600: "#b8924a",
        },
        accent: {
          ok: "#3ddc84",
          warn: "#f5b342",
          crit: "#ff5c5c",
          info: "#5aa9ff",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(212,175,95,0.15)",
      },
    },
  },
  plugins: [],
};
