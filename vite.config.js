import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import subtitlesHandler from './api/subtitles.js';
import streamHandler from './api/stream.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const iptvServer = (env.VITE_IPTV_SERVER || '').replace(/\/+$/, '');
  const iptvUser = env.VITE_IPTV_USER || '';
  const iptvPass = env.VITE_IPTV_PASS || '';

  // Populate process.env so serverless functions can read them locally
  process.env.VITE_IPTV_SERVER = iptvServer;
  process.env.VITE_IPTV_USER = iptvUser;
  process.env.VITE_IPTV_PASS = iptvPass;

  if (!iptvServer || !iptvUser || !iptvPass) {
    console.warn(
      '\x1b[33m%s\x1b[0m',
      '⚠️  [WARNING] Faltan variables de entorno IPTV (VITE_IPTV_SERVER, VITE_IPTV_USER o VITE_IPTV_PASS). Por favor crea o configura tu archivo .env local.'
    );
  }

  return {
    plugins: [
      react(),
      {
        name: 'subtitles-api',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.method === 'OPTIONS' && (req.url.startsWith('/api_stream') || req.url.startsWith('/api_hlsr'))) {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
              res.statusCode = 200;
              res.end();
              return;
            }

            if (req.url.startsWith('/api_stream')) {
              try {
                await streamHandler(req, res);
              } catch (err) {
                console.error('Local Stream Proxy Middleware Error:', err);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              }
              return;
            }

            if (req.url.startsWith('/api_subtitles') || req.originalUrl?.startsWith('/api_subtitles')) {
              try {
                await subtitlesHandler(req, res);
              } catch (err) {
                console.error('Local Subtitles Middleware Error:', err);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              }
            } else {
              next();
            }
          });
        }
      }
    ],
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
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes, req, res) => {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
            });
          },
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
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes, req, res) => {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
            });
          },
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
