/**
 * Vercel Serverless Stream Proxy
 * Streams IPTV video content over HTTPS with Range request & CORS support.
 * Resolves Mixed Content (HTTPS -> HTTP) blocking and hides credentials completely.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const server = (process.env.VITE_IPTV_SERVER || 'http://reydereyes.xyz:8080').replace(/\/+$/, '');
  const user = process.env.VITE_IPTV_USER || 'JosueMejia';
  const pass = process.env.VITE_IPTV_PASS || 'PPw3tAhK4P';

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const match = urlObj.pathname.match(/^\/api_stream\/([^/]+)\/(.+)$/);

  if (!match) {
    return res.status(400).json({ error: 'Ruta de transmisión inválida' });
  }

  const [, type, file] = match;
  const targetStreamUrl = `${server}/${type}/${user}/${pass}/${file}`;

  const upstreamHeaders = {};
  if (req.headers.range) {
    upstreamHeaders['range'] = req.headers.range;
  }

  try {
    const upstream = await fetch(targetStreamUrl, {
      headers: upstreamHeaders,
      method: req.method,
    });

    const isHls = file.endsWith('.m3u8') || file.endsWith('.ts');
    const contentType = upstream.headers.get('content-type') || (isHls ? 'application/x-mpegURL' : 'video/mp4');

    res.setHeader('Content-Type', contentType);

    if (upstream.headers.get('content-length')) {
      res.setHeader('Content-Length', upstream.headers.get('content-length'));
    }
    if (upstream.headers.get('content-range')) {
      res.setHeader('Content-Range', upstream.headers.get('content-range'));
    }
    if (upstream.headers.get('accept-ranges')) {
      res.setHeader('Accept-Ranges', upstream.headers.get('accept-ranges'));
    }

    res.status(upstream.status);

    if (req.method === 'HEAD') {
      return res.end();
    }

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    return res.end();
  } catch (error) {
    console.error('Vercel Stream Proxy Error:', error);
    return res.status(500).json({ error: 'Error al canalizar la transmisión del video' });
  }
}
