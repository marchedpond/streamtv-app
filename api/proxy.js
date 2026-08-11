/**
 * Vercel Serverless Function Proxy for IPTV API
 * Injects credentials server-side to hide them completely from the browser client.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const server = (process.env.VITE_IPTV_SERVER || 'http://reydereyes.xyz:8080').replace(/\/+$/, '');
  const user = process.env.VITE_IPTV_USER || 'JosueMejia';
  const pass = process.env.VITE_IPTV_PASS || 'PPw3tAhK4P';

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const searchParams = new URLSearchParams(urlObj.search);
  
  // Inject credentials on server side
  searchParams.set('username', user);
  searchParams.set('password', pass);

  const targetUrl = `${server}/player_api.php?${searchParams.toString()}`;

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
    return res.status(500).json({ error: 'No se pudo conectar con el servicio IPTV' });
  }
}
