/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          1000: "#03050a",
          950: "#070a12",
          900: "#0b0f1a",
          850: "#0f1422",
          800: "#141a2b",
          750: "#182034",
          700: "#1c2438",
          600: "#27314a",
          500: "#3a4768",
          400: "#5c6b90",
          300: "#8e9bbd",
          200: "#c3cbe0",
          100: "#e6e9f2",
        },
        gold: {
          300: "#f0ddb0",
          400: "#e8c87a",
          500: "#d4af5f",
          600: "#b8924a",
          700: "#8f6f33",
        },
        status: {
          ok: "#3ddc84",
          warn: "#f5b342",
          crit: "#ff5c5c",
          info: "#5aa9ff",
          ai: "#c084fc",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        display: ["28px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "600" }],
        title: ["20px", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
        "card-title": ["16px", { lineHeight: "1.4", fontWeight: "500" }],
        label: ["12px", { lineHeight: "1.2", letterSpacing: "0.05em", fontWeight: "500" }],
        body: ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        caption: ["12px", { lineHeight: "1.4", fontWeight: "400" }],
        mono: ["13px", { lineHeight: "1.5", fontWeight: "400" }],
        metric: ["32px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "600" }],
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "2xl": "32px",
        "3xl": "48px",
      },
      borderRadius: {
        pill: "999px",
        input: "8px",
        card: "12px",
        modal: "16px",
      },
      boxShadow: {
        glow: "0 0 24px rgba(212,175,95,0.15)",
        "glow-sm": "0 0 12px rgba(212,175,95,0.12)",
        "glow-lg": "0 0 36px rgba(212,175,95,0.2)",
        card: "0 1px 2px rgba(0,0,0,0.2)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.25)",
        elevated: "0 8px 24px rgba(0,0,0,0.3)",
        modal: "0 16px 48px rgba(0,0,0,0.4)",
        inset: "inset 0 1px 2px rgba(0,0,0,0.2)",
      },
      transitionDuration: {
        micro: "150ms",
        card: "200ms",
        page: "250ms",
      },
      transitionTimingFunction: {
        "micro-out": "ease-out",
        page: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(1.2)" },
        },
        "orbit-dot": {
          "0%": { transform: "rotate(0deg) translateX(4px) rotate(0deg)" },
          "100%": { transform: "rotate(360deg) translateX(4px) rotate(-360deg)" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out forwards",
        "fade-in-up": "fade-in-up 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards",
        "slide-in-right": "slide-in-right 0.3s ease-out forwards",
        shimmer: "shimmer 1.5s linear infinite",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "orbit-dot": "orbit-dot 2s linear infinite",
        "spin-slow": "spin-slow 3s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
