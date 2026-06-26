import type { Config } from 'tailwindcss';

// Design tokens mirror the Flutter app's ThemeData / SettingsTheme palette.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0F172A', // scaffoldBackground
          surface: '#1E293B',
          elevated: '#263549',
          deep: '#0A1628', // ticker bar
        },
        accent: {
          teal: '#14B8A6', // primary
          blue: '#3B82F6', // secondary
          gold: '#F59E0B',
          amber: '#FBBF24',
          red: '#EF4444',
          green: '#4ADE80',
          sky: '#38BDF8',
          orange: '#FB923C',
        },
        ink: {
          primary: '#E2E8F0',
          secondary: '#94A3B8',
          muted: '#64748B',
          faint: '#475569',
          line: '#334155',
        },
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', 'sans-serif'],
        amiri: ['Amiri', 'serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
