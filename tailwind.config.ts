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
        line: "#262626",
        ocean: "#00E5FF",
        coral: "#FF2D75",
        citrus: "#FFEA00",
        surface: "#1A1A1A",
      },
      boxShadow: {
        lift: "0 0 60px rgba(0, 229, 255, 0.06), 0 16px 40px rgba(0, 0, 0, 0.40)",
      },
    },
  },
  plugins: [],
} satisfies Config;
