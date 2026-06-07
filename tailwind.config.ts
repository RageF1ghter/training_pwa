import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#EEEAE4",
        mist: "#0D0D0D",
        line: "rgba(255, 255, 255, 0.08)",
        ocean: "#00E5FF",
        coral: "#FF2D75",
        citrus: "#FFEA00",
        surface: "#1A1A1A",
        glass: "rgba(255, 255, 255, 0.05)",
        "glass-heavy": "rgba(13, 13, 13, 0.82)",
      },
      boxShadow: {
        lift: "0 0 60px rgba(0, 229, 255, 0.06), 0 16px 40px rgba(0, 0, 0, 0.40)",
        glass: "0 8px 32px rgba(0, 0, 0, 0.24), 0 0 0 1px rgba(255, 255, 255, 0.06) inset",
      },
    },
  },
  plugins: [],
} satisfies Config;
