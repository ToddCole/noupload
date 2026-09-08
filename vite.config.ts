import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react],
  build: {
    rollupOptions: {
      input: {
        main: new URL('./index.html', import.meta.url).pathname,
        metaStripper: new URL('./meta-stripper/index.html', import.meta.url).pathname,
        shareSafe: new URL('./share-safe/index.html', import.meta.url).pathname,
        removeGps: new URL('./remove-gps-from-photo/index.html', import.meta.url).pathname,
        redact: new URL('./redact/index.html', import.meta.url).pathname,
        compress: new URL('./compress/index.html', import.meta.url).pathname,
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
});
