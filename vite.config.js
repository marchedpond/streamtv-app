import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const iptvServer = env.VITE_IPTV_SERVER || 'http://reydereyes.xyz:8080';

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
          rewrite: (path) => path.replace(/^\/api_proxy/, ''),
        },
      },
    },
  };
});
