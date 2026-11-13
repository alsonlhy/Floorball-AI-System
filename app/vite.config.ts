/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Konva + React are one ~570 kB chunk (177 kB gzip); fine for an offline-first app.
  build: { chunkSizeWarningLimit: 800 },
  server: { port: 5173, strictPort: true },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
