import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], test: {
  allowOnly: !process.env.CI,
  environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], setupFiles: ['./src/test-setup.ts'],
  coverage: {
    provider: 'v8', include: ['src/**/*.{ts,tsx}'],
    // Entry wiring and lazy chunk failure/reload are exercised by the real browser suite.
    exclude: ['src/**/*.test.{ts,tsx}', 'src/test-setup.ts', 'src/main.tsx', 'src/vite-env.d.ts'],
    reporter: ['text', 'html', 'json-summary'],
    thresholds: { statements: 90, lines: 90, functions: 90, branches: 85,
      'src/lib/dates.ts': { branches: 100 }, 'src/auth/AuthProvider.tsx': { branches: 100 },
      'src/components/BookingRecovery.tsx': { branches: 100 },
    },
  },
} });

