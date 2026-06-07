import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        mist: "var(--color-mist)",
        line: "var(--color-line)",
        ocean: "rgb(var(--ocean-rgb) / <alpha-value>)",
        coral: "rgb(var(--coral-rgb) / <alpha-value>)",
        citrus: "var(--color-citrus)",
        surface: "var(--color-surface)",
        glass: "var(--color-glass)",
        "glass-heavy": "var(--color-glass-heavy)",
      },
      boxShadow: {
        lift: "0 0 60px rgba(0, 229, 255, 0.06), 0 16px 40px rgba(0, 0, 0, 0.40)",
        glass: "0 8px 32px rgba(0, 0, 0, 0.32), 0 0 0 1px rgba(255, 255, 255, 0.08) inset",
      },
    },
  },
  plugins: [],
} satisfies Config;
