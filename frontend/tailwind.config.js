/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0c",
        sidebar: "rgba(20, 20, 23, 0.8)",
        card: "#16161a",
        accent: {
          primary: "#6366f1", // Indigo
          secondary: "#a855f7", // Purple
          success: "#10b981", // Emerald
        }
      },
      backdropBlur: {
        xs: "2px",
      }
    },
  },
  plugins: [],
}
