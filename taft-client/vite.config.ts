import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Карты предварительно конвертируются в WebP скриптом
// `npm run optimize-cards` (см. scripts/optimize-cards.mjs).
// Поэтому отдельный image-optimizer плагин не нужен.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
