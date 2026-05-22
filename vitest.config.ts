import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    root: __dirname,
    environment: 'jsdom',
    globals: true,
    setupFiles: path.resolve(__dirname, 'src/test/setup.ts'),
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
        '**/migrate*.ts',
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
      perFile: true,
    },
  },
});
