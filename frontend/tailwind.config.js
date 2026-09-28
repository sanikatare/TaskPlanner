/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted:   '#f8fafc',
          page:    '#f8faff',
          border:  '#e2e8f0',
        },
      },
      fontFamily: {
        sans:    ['"Playfair Display"', 'Georgia', 'serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        serif:   ['"Playfair Display"', 'Georgia', 'serif'],
        mono:    ['"Playfair Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        card:    '0 1px 3px rgba(15,23,42,0.04), 0 4px 16px rgba(37,99,235,0.04)',
        'card-hover': '0 4px 12px rgba(15,23,42,0.06), 0 12px 32px rgba(37,99,235,0.08)',
        soft:    '0 2px 8px rgba(37,99,235,0.08)',
        sidebar: '4px 0 24px rgba(15,23,42,0.03)',
        glow:    '0 0 24px rgba(37, 99, 235, 0.15)',
        'glow-sm': '0 0 12px rgba(37, 99, 235, 0.1)',
        float:   '0 12px 40px rgba(37, 99, 235, 0.12), 0 4px 12px rgba(15,23,42,0.04)',
      },
      animation: {
        'fade-up':    'fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in':    'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-left': 'slideLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up':   'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'scale-in':   'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'shimmer':    'shimmer 1.8s ease-in-out infinite',
      },
      keyframes: {
        fadeUp:    { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn:    { from: { opacity: '0' }, to: { opacity: '1' } },
        slideLeft: { from: { opacity: '0', transform: 'translateX(-16px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(24px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn:   { from: { opacity: '0', transform: 'scale(0.95)' }, to: { opacity: '1', transform: 'scale(1)' } },
        shimmer:   { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      opacity: {
        2: '0.02', 3: '0.03', 4: '0.04', 6: '0.06', 8: '0.08', 12: '0.12', 15: '0.15',
      },
    },
  },
  plugins: [],
};
