import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/{application,domain}/**/*.ts'],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: {
        branches: 95,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
  },
})
