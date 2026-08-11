/**
 * Universal Vercel Serverless Raw Proxy
 * Proxies any HTTP media URL (M3U8 playlists, TS video segments, MP4 files) over HTTPS
 * Eliminates Mixed Content blocking for Live TV streams on Vercel deployments.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const targetUrl = urlObj.searchParams.get('url');

  if (!targetUrl) {
    return res.status(400).send('Missing url parameter');
  }

  const upstreamHeaders = {};
  if (req.headers.range) {
    upstreamHeaders['range'] = req.headers.range;
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: upstreamHeaders,
      method: req.method,
    });

    const contentType = upstream.headers.get('content-type') || (targetUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4');
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
    console.error('Raw Proxy Error:', error);
    return res.status(500).send('Error en proxy de transmisión');
  }
}
