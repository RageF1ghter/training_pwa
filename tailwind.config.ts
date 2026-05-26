import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#1B2317",
        mist: "#F4F9EE",
        line: "#D6E5C7",
        ocean: "#8CD600",
        coral: "#FF5C3A",
        citrus: "#F0B800",
      },
      boxShadow: {
        lift: "0 16px 40px rgba(27, 35, 23, 0.10)",
      },
    },
  },
  plugins: [],
} satisfies Config;
