/**
 * Vercel Serverless Proxy Route
 * Proxies Xtream Codes API requests from HTTPS (Vercel) to HTTP (IPTV Server)
 * Resolves Mixed Content security blocking in production browser deployments.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const server = (process.env.VITE_IPTV_SERVER || 'http://reydereyes.xyz:8080').replace(/\/+$/, '');
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const queryString = urlObj.search;

  const targetUrl = `${server}/player_api.php${queryString}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timer);

    const contentType = response.headers.get('content-type') || 'application/json';
    res.setHeader('Content-Type', contentType);

    const data = await response.text();
    return res.status(response.status).send(data);
  } catch (error) {
    console.error('Vercel IPTV Proxy Error:', error);
    return res.status(500).json({ error: 'Proxy error connecting to IPTV server', details: error.message });
  }
}
