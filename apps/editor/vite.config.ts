import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Only the production build is served under /editor/ (assets + play.html
  // resolve relative to this base). Dev stays at the server root so
  // http://localhost:5173/ loads the editor directly.
  base: command === 'build' ? '/editor/' : '/',
  plugins: [react()],
  assetsInclude: ['**/*.asm'],
  build: {
    // Emit into the site's dist so one static folder ships both:
    //   apps/web/dist/         -> landing page (/)
    //   apps/web/dist/editor/  -> this editor (/editor/)
    outDir: resolve(__dirname, '../web/dist/editor'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        play: resolve(__dirname, 'play.html'),
      },
    },
  },
}));
