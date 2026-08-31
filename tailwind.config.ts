import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1B1E27",
        paper: "#FAFAF8",
        line: "#E4E2DC",
        accent: "#2F5D50",
        accentSoft: "#E6EDE9",
        flag: "#C0562F",
        muted: "#6B6F76"
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        sans: ["'Inter'", "system-ui", "sans-serif"]
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        lg: "10px"
      }
    }
  },
  plugins: []
};
export default config;
