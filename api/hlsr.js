/**
 * Vercel Serverless Function for HLS TS Video Segments (/hlsr/*)
 * Proxies HLS TS video segments over HTTPS to eliminate Mixed Content blocking.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const server = (process.env.VITE_IPTV_SERVER || 'http://reydereyes.xyz:8080').replace(/\/+$/, '');
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const segmentPath = urlObj.pathname.replace(/^\/api_hlsr\/?/, '');

  const targetUrl = `${server}/hlsr/${segmentPath}`;

  try {
    const upstream = await fetch(targetUrl, { method: req.method });

    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/mp2t');
    if (upstream.headers.get('content-length')) {
      res.setHeader('Content-Length', upstream.headers.get('content-length'));
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
    console.error('Vercel HLSR Segment Proxy Error:', error);
    return res.status(500).end();
  }
}
