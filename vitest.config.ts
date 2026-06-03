import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Resolve the `@/*` → `src/*` alias from tsconfig.json natively.
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
