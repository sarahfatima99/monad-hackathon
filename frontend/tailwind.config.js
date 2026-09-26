/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        monad: { DEFAULT: "#836EF9", light: "#A99BFF", dark: "#5B45D9" }
      }
    }
  },
  plugins: []
};
