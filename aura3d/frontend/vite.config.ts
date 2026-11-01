import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('../', import.meta.url)), 'DJANGO_ADMIN_URL');
  const adminPath = (process.env.DJANGO_ADMIN_URL ?? env.DJANGO_ADMIN_URL ?? 'admin/').replace(/^\/+|\/+$/g, '');
  if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(adminPath) || ['api', 'api-auth', 'ws', 'media', 'static', 'assets', 'healthz'].includes(adminPath.split('/')[0])) {
    throw new Error('DJANGO_ADMIN_URL must be a nonempty URL path using letters, numbers, hyphens, underscores and slashes, outside the API/static/media routes.');
  }
  const backend = process.env.API_PROXY_TARGET || 'http://localhost:8000';
  return {
    plugins: [react()],
    server: { proxy: { '/api': backend, [`^/${adminPath}(?:/|$)`]: backend, '/media': backend, '/static': backend, '/ws': { target: backend, ws: true } } },
    build: { chunkSizeWarningLimit: 1400 },
  };
});
