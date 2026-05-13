/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FFFFFF",
        sidebar: "#F8F9FA",
        card: "#FFFFFF",
        axis: {
          burgundy: "#891B3F",
          red: "#EB1165",
          gray: "#F5F7FA",
        },
        accent: {
          primary: "#891B3F", // Burgundy
          secondary: "#EB1165", // Ruby Red
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
