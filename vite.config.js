import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const iptvServer = (env.VITE_IPTV_SERVER || '').replace(/\/+$/, '');
  const iptvUser = env.VITE_IPTV_USER || '';
  const iptvPass = env.VITE_IPTV_PASS || '';

  if (!iptvServer || !iptvUser || !iptvPass) {
    console.warn(
      '\x1b[33m%s\x1b[0m',
      '⚠️  [WARNING] Faltan variables de entorno IPTV (VITE_IPTV_SERVER, VITE_IPTV_USER o VITE_IPTV_PASS). Por favor crea o configura tu archivo .env local.'
    );
  }

  return {
    plugins: [react()],
    server: {
      port: 3000,
      open: true,
      proxy: {
        '/api_proxy': {
          target: iptvServer,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => {
            const cleanPath = path.replace(/^\/api_proxy\/?/, '');
            const authParams = `username=${encodeURIComponent(iptvUser)}&password=${encodeURIComponent(iptvPass)}`;
            if (cleanPath.startsWith('?')) {
              return `/player_api.php${cleanPath}&${authParams}`;
            } else if (cleanPath) {
              return `/player_api.php?${cleanPath}&${authParams}`;
            }
            return `/player_api.php?${authParams}`;
          },
        },
        '/api_stream': {
          target: iptvServer,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => {
            return path.replace(/^\/api_stream\/([^/]+)\/(.+)$/, (match, type, file) => {
              return `/${type}/${iptvUser}/${iptvPass}/${file}`;
            });
          },
        },
        '/api_hlsr': {
          target: iptvServer,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => {
            const cleanPath = path.replace(/^\/api_hlsr\/?/, '');
            const authParams = `username=${encodeURIComponent(iptvUser)}&password=${encodeURIComponent(iptvPass)}`;
            const hasQuery = cleanPath.includes('?');
            return hasQuery
              ? `/hlsr/${cleanPath}&${authParams}`
              : `/hlsr/${cleanPath}?${authParams}`;
          },
        },
      },
    },
  };
});
