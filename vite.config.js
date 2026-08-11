import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const iptvServer = (env.VITE_IPTV_SERVER || 'http://reydereyes.xyz:8080').replace(/\/+$/, '');
  const iptvUser = env.VITE_IPTV_USER || 'JosueMejia';
  const iptvPass = env.VITE_IPTV_PASS || 'PPw3tAhK4P';

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
            // Replaces /api_stream/movie/123.mp4 -> /movie/USER/PASS/123.mp4
            return path.replace(/^\/api_stream\/([^/]+)\/(.+)$/, (match, type, file) => {
              return `/${type}/${iptvUser}/${iptvPass}/${file}`;
            });
          },
        },
      },
    },
  };
});
