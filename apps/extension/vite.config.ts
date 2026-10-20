import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { crx } from '@crxjs/vite-plugin';
import { manifest } from './manifest.config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return { plugins: [react(), tailwind(), crx({ manifest: manifest(env.VITE_API_URL || 'http://localhost:3001', env.VITE_EXTENSION_PUBLIC_KEY) })],
    server: { port: 5173, strictPort: true }, build: { sourcemap: false } };
});
