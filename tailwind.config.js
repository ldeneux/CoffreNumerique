/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
      },
    },
  },
  plugins: [],
};
