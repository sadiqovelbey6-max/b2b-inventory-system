import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    process.env.ANALYZE === 'true'
      ? visualizer({
          filename: 'bundle-report.html',
          open: false,
          gzipSize: true,
          brotliSize: true,
        })
      : undefined,
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    globals: true,
    pool: 'threads',
    coverage: {
      reporter: ['text', 'lcov'],
      exclude: ['src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
});
