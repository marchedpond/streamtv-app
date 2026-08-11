/**
 * Vercel Serverless Function for HLS TS Video Segments (/api_hlsr)
 * Proxies HLS TS video segments over HTTPS directly from the target direct streaming server.
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

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const host = urlObj.searchParams.get('host');
  const file = urlObj.searchParams.get('file');

  if (!host || !file) {
    res.statusCode = 400;
    return res.end('Missing host or file parameter');
  }

  const targetUrl = `${host}/hlsr/${file}`;

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
    res.statusCode = 500;
    return res.end();
  }
}
