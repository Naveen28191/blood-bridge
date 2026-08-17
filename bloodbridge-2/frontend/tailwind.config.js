/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070B14",
          900: "#0B1220",
          800: "#121B2E",
          700: "#1B2740",
          600: "#28375A",
        },
        paper: {
          50: "#FBFBF9",
          100: "#F4F3EF",
          200: "#E8E6DF",
        },
        signal: {
          DEFAULT: "#E11D3C",
          soft: "#FCE4E8",
        },
        amber: {
          DEFAULT: "#F5A623",
          soft: "#FDF0DC",
        },
        teal: {
          DEFAULT: "#1FAE7A",
          soft: "#DFF5EC",
        },
        slate: {
          DEFAULT: "#3B82C4",
          soft: "#E3EEF9",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      boxShadow: {
        console: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};
