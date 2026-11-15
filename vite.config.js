import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages publishes this project under /AI-Novel/.
// Keep the base path aligned with the repository name.
export default defineConfig({
  plugins: [react()],
  base: '/AI-Novel/',
  server: {
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
});
