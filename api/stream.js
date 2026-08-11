/**
 * Vercel Serverless Stream Proxy
 * Streams IPTV video content over HTTPS with Range request & CORS support.
 * Rewrites HLS .m3u8 manifests to use /api_hlsr/ for TS segment proxying.
 */
export default async function handler(req, res) {
  // Polyfill Vercel helper methods if run under standard Node.js (Vite middleware)
  if (typeof res.status !== 'function') {
    res.status = function (statusCode) {
      this.statusCode = statusCode;
      return this;
    };
  }
  if (typeof res.json !== 'function') {
    res.json = function (obj) {
      this.setHeader('Content-Type', 'application/json');
      this.end(JSON.stringify(obj));
      return this;
    };
  }
  if (typeof res.send !== 'function') {
    res.send = function (data) {
      this.end(data);
      return this;
    };
  }

  let headersSent = false;

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

    const isM3u8 = file.endsWith('.m3u8') || (upstream.headers.get('content-type') || '').includes('mpegurl');

    if (isM3u8 && req.method === 'GET') {
      let m3u8Text = await upstream.text();

      // Get the redirected final origin from the upstream response URL
      const finalUrl = new URL(upstream.url);
      const redirectOrigin = finalUrl.origin; // e.g. "http://121.91.224.166:8080"

      // Rewrite relative /hlsr/ segment URLs to include the redirectOrigin host as a query parameter
      const encodedOrigin = encodeURIComponent(redirectOrigin);
      m3u8Text = m3u8Text.replace(/\/hlsr\//g, `/api_hlsr?host=${encodedOrigin}&file=`);

      res.setHeader('Content-Type', 'application/x-mpegURL');
      return res.status(200).send(m3u8Text);
    }

    const contentType = upstream.headers.get('content-type') || 'video/mp4';
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
    headersSent = true;

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
    // If the client disconnected mid-stream, this is expected — don't log as error
    const isClientDisconnect = error?.cause?.code === 'UND_ERR_SOCKET' ||
      error?.message?.includes('terminated') ||
      error?.message?.includes('aborted');
    if (!isClientDisconnect) {
      console.error('Vercel Stream Proxy Error:', error);
    }
    // Only send error response if we haven't started streaming yet
    if (!headersSent) {
      try {
        return res.status(500).json({ error: 'Error al canalizar la transmisión del video' });
      } catch (_) { /* ignore */ }
    }
  }
}
