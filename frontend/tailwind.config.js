/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#b98f42", // champagne gold
        secondary: "#1a1a1a", // deep black
      },
      fontFamily: {
        sans: ["var(--font-work-sans)", "sans-serif"],
        arabic: ["var(--font-cairo)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
