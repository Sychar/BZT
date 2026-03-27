module.exports = {
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./context/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Manrope'", "sans-serif"],
        body: ["'Manrope'", "sans-serif"]
      },
      colors: {
        paper: "#FAF8F4",
        ink: "#1C1C1C",
        cream: "#F4EEE5",
        "cream-soft": "#F8F3EC",
        taupe: "#CFC5BA",
        neutral: "#E8DFD4",
        forest: "#233736",
        brand: {
          50: "#fbf1ed",
          100: "#f5e0d8",
          200: "#ecd0c2",
          300: "#e2b49f",
          400: "#d89072",
          500: "#c65a3a",
          600: "#aa4930",
          700: "#8f3d2b",
          800: "#6f2f22",
          900: "#4f2219"
        },
        slate: {
          950: "#1C1C1C"
        }
      }
    }
  },
  plugins: []
};
