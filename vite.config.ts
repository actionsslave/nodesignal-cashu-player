import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  // SFR-02: Auslieferung als statisches Bundle von der Wurzel einer eigenen Origin.
  base: '/',
  build: {
    target: 'es2022',
    rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html') } },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    setupFiles: ['test/setup.ts'],
  },
});
