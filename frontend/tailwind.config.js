/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Wise-inspired design system (DESIGN.md)
        // Light theme: sage canvas, white cards, lime-green accent
        ink: {
          1000: "#0e0f0c",  // near-black ink (primary text)
          950: "#e8ebe6",   // sage canvas (page background)
          900: "#ffffff",   // white (panel background)
          850: "#ffffff",   // white (card background)
          800: "#e8ebe6",   // sage (card hover / secondary surface)
          750: "#e8ebe6",   // sage
          700: "#d4d8d0",   // light sage border
          600: "#b8beb4",   // border hover
          500: "#868685",   // mute (lowest priority text)
          400: "#454745",   // body (secondary text)
          300: "#454745",   // body
          200: "#454745",   // body
          100: "#0e0f0c",   // ink (primary text on light surfaces)
        },
        gold: {
          300: "#6B7E3C",   // lighter army green (hover/active states)
          400: "#4A5D23",   // army green (primary accent)
          500: "#4A5D23",   // army green (primary)
          600: "#3A4A1C",   // darker army green (hover)
          700: "#2A3A14",   // very dark army green (text on light)
        },
        status: {
          ok: "#3a7d2c",    // positive (darker green for contrast on white)
          warn: "#b86700",   // warning-deep (readable on light)
          crit: "#d03238",   // negative
          info: "#0e7fb0",   // darker cyan for contrast on white
          ai: "#4A5D23",     // army green for AI indicators
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
        input: "12px",   // Wise rounded.md
        card: "24px",    // Wise rounded.xl (canonical)
        modal: "24px",   // Wise rounded.xl
      },
      boxShadow: {
        glow: "0 0 24px rgba(74, 93, 35, 0.2)",
        "glow-sm": "0 0 12px rgba(74, 93, 35, 0.15)",
        "glow-lg": "0 0 36px rgba(74, 93, 35, 0.25)",
        card: "0 1px 3px rgba(14,15,12,0.06)",
        "card-hover": "0 4px 16px rgba(14,15,12,0.08)",
        elevated: "0 8px 24px rgba(14,15,12,0.10)",
        modal: "0 16px 48px rgba(14,15,12,0.12)",
        inset: "inset 0 1px 2px rgba(14,15,12,0.06)",
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
