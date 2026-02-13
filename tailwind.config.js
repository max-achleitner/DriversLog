/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Touring Blue
        primary: {
          DEFAULT: '#1B3A4B',
          light: '#2D5F7A',
          dark: '#0F2330',
        },
        // British Racing Green
        accent: {
          DEFAULT: '#2E5A3C',
          light: '#3D7A50',
          dark: '#1A3623',
        },
        // Saddletan (Leder)
        warm: {
          DEFAULT: '#8B6F47',
          light: '#B8956A',
          dark: '#5C4A2F',
        },
        // Hintergruende
        background: {
          DEFAULT: '#F5F2ED',
          card: '#FFFFFF',
          dark: '#1A1A1A',
        },
        // Text
        text: {
          DEFAULT: '#1A1A1A',
          secondary: '#6B7280',
          light: '#F5F2ED',
          muted: '#9CA3AF',
        },
        // Status
        error: '#B91C1C',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
