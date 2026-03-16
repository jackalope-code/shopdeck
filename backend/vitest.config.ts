import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['backend/tests/**/*.test.js', 'tests/**/*.test.js'],
    globals: true,
    restoreMocks: true,
    clearMocks: true,
  },
});
