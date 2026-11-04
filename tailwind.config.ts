import type { Config } from "tailwindcss";

// Design tokens ported from PRD §9 / prototype CSS variables (:root).
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // CSS-variable-backed so a `[data-theme="dark"]` override on <html>
        // re-themes the whole app without touching component classNames.
        bg: "rgb(var(--c-bg) / <alpha-value>)",
        bg2: "rgb(var(--c-bg2) / <alpha-value>)",
        bg3: "rgb(var(--c-bg3) / <alpha-value>)",
        border: "rgb(var(--c-border) / <alpha-value>)",
        cyan: {
          DEFAULT: "rgb(var(--c-cyan) / <alpha-value>)",
          dark: "rgb(var(--c-cyan-dark) / <alpha-value>)",
          focus: "rgb(var(--c-cyan-focus) / <alpha-value>)",
        },
        green: "rgb(var(--c-green) / <alpha-value>)",
        yellow: "rgb(var(--c-yellow) / <alpha-value>)",
        red: "rgb(var(--c-red) / <alpha-value>)",
        purple: "rgb(var(--c-purple) / <alpha-value>)",
        pink: "rgb(var(--c-pink) / <alpha-value>)",
        t1: "rgb(var(--c-t1) / <alpha-value>)",
        t2: "rgb(var(--c-t2) / <alpha-value>)",
        t3: "rgb(var(--c-t3) / <alpha-value>)",
        nav: "rgb(var(--c-nav) / <alpha-value>)",
      },
      // Text-only overrides: `text-green` etc. use the contrast-safe *-text tokens
      // (app/globals.css), while `bg-green`, `border-green`, fills and charts keep
      // the bright brand colours above. Fixes status text at 2.2–3.8:1 on white.
      textColor: {
        green: "rgb(var(--c-ok-text) / <alpha-value>)",
        yellow: "rgb(var(--c-warn-text) / <alpha-value>)",
        red: "rgb(var(--c-crit-text) / <alpha-value>)",
        purple: "rgb(var(--c-purple-text) / <alpha-value>)",
        pink: "rgb(var(--c-pink-text) / <alpha-value>)",
        cyan: {
          DEFAULT: "rgb(var(--c-cyan-text) / <alpha-value>)",
          dark: "rgb(var(--c-cyan-dark) / <alpha-value>)",
          focus: "rgb(var(--c-cyan-focus) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        pill: "9999px",
      },
      boxShadow: {
        product: "3px 5px 30px rgba(0,0,0,.22)",
        card: "var(--shadow-card)",
      },
    },
  },
  plugins: [],
};

export default config;
