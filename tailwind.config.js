/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          rose: '#F8B2B2',
          mauve: '#AF719D',
          purple: '#8B639B',
          indigo: '#403D88',
        },
      },
      fontFamily: {
        sans: ['"Outfit"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Fraunces"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
