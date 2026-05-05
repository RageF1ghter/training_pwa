import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#172033",
        mist: "#f5f7fb",
        line: "#dde4ee",
        ocean: "#0f8f88",
        coral: "#f06a55",
        citrus: "#f4b13d",
      },
      boxShadow: {
        lift: "0 16px 40px rgba(23, 32, 51, 0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;
