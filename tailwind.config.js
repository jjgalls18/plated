/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cream: '#F7F4EF',
        primary: {
          DEFAULT: '#C4622D',
          50: '#FDF5EF',
          100: '#FAE6D5',
          200: '#F4C9A8',
          300: '#ECAA7A',
          400: '#E38A4D',
          500: '#C4622D',
          600: '#A44D22',
          700: '#833B19',
          800: '#622C13',
          900: '#411D0C',
        },
        sage: {
          DEFAULT: '#5C7A5F',
          50: '#EFF4EF',
          100: '#D9E8DA',
          200: '#B3D1B5',
          300: '#8DB990',
          400: '#6BA16E',
          500: '#5C7A5F',
          600: '#4A624C',
          700: '#384B3A',
          800: '#263428',
          900: '#141D15',
        },
        warm: {
          50: '#FDFCF9',
          100: '#F7F4EF',
          200: '#EDE8DF',
          300: '#E0D9CE',
          400: '#CEC5B8',
          500: '#B8AFA1',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 2px 16px rgba(0,0,0,0.06)',
        'card-hover': '0 8px 32px rgba(0,0,0,0.12)',
        nav: '0 -1px 0 rgba(0,0,0,0.06), 0 -8px 32px rgba(0,0,0,0.06)',
        soft: '0 4px 24px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        shimmer: 'shimmer 1.8s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
