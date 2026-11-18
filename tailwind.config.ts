import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: "#EDEFEA",
        sheet: "#F8F8F4",
        ink: "#1C231F",
        "ink-soft": "#5B6560",
        blueprint: "#2F5D82",
        "blueprint-soft": "#DCE6EC",
        amber: "#B08A2E",
        "amber-soft": "#F1E8D2",
        correction: "#A3402E",
        "correction-soft": "#F3DEDA",
        ok: "#3D6B4A",
        "ok-soft": "#DDEADF",
        line: "#C9CDC3",
      },
      borderRadius: { DEFAULT: "3px" },
    },
  },
  plugins: [],
};

export default config;
