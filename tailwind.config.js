/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f6f6f2",      // cool paper, not cream
        surface: "#ffffff",
        line: "#e4e4dd",       // hairline ledger rule
        ink: "#1a1d1b",
        muted: "#71766d",
        brand: {
          DEFAULT: "#1f3d34",  // deep pine
          dark: "#16302a",
          50: "#eef2f0",
          100: "#dfe7e3",
        },
        ok: "#2f7d57",
        warn: "#9a6a16",
        danger: "#a23b32",
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { DEFAULT: "4px", md: "5px", lg: "7px" },
      boxShadow: {
        card: "0 1px 2px rgba(26,29,27,0.04), 0 1px 1px rgba(26,29,27,0.03)",
        pop: "0 8px 30px rgba(26,29,27,0.12)",
      },
    },
  },
  plugins: [],
};
