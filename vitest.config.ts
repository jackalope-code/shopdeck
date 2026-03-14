import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'pages/**/*.test.{ts,tsx}'],
    exclude: ['backend/**', 'e2e/**', 'node_modules/**'],
    restoreMocks: true,
    clearMocks: true,
  },
});
