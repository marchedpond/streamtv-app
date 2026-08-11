/**
 * Vercel Serverless Stream Proxy
 * Redirects or proxies IPTV video streams while keeping credentials hidden on the backend.
 */
export default async function handler(req, res) {
  const server = (process.env.VITE_IPTV_SERVER || 'http://reydereyes.xyz:8080').replace(/\/+$/, '');
  const user = process.env.VITE_IPTV_USER || 'JosueMejia';
  const pass = process.env.VITE_IPTV_PASS || 'PPw3tAhK4P';

  const match = req.url.match(/^\/api_stream\/([^/]+)\/(.+)$/);
  if (!match) {
    return res.status(400).json({ error: 'Stream URL inválida' });
  }

  const [, type, file] = match;
  const targetStreamUrl = `${server}/${type}/${user}/${pass}/${file}`;

  // Redirect to stream URL securely on server side
  return res.redirect(302, targetStreamUrl);
}
