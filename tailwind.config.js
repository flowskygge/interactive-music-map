/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./data/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gray-900': '#121212',
        'gray-800': '#1E1E1E',
        'gray-700': '#282828',
        'gray-600': '#3E3E3E',
        'gray-400': '#B3B3B3',
      },
    },
  },
  plugins: [],
}

