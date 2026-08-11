import { SubtitleParser } from 'matroska-subtitles';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const server = (process.env.VITE_IPTV_SERVER || 'http://reydereyes.xyz:8080').replace(/\/+$/, '');
  const user = process.env.VITE_IPTV_USER || 'JosueMejia';
  const pass = process.env.VITE_IPTV_PASS || 'PPw3tAhK4P';

  // Normalize query parameters for both Vercel serverless and Vite middleware
  const getQueryParams = (request) => {
    if (request.query) return request.query;
    const urlObj = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    return Object.fromEntries(urlObj.searchParams.entries());
  };

  const query = getQueryParams(req);
  const { id, type, action, track, ext } = query;

  if (!id || !type) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Missing id or type parameter' }));
  }

  // Determine path type (movie/vod -> /movie/, series -> /series/)
  const pathType = (type === 'vod' || type === 'movie') ? 'movie' : 'series';
  const extension = ext || 'mkv';
  const targetStreamUrl = `${server}/${pathType}/${user}/${pass}/${id}.${extension}`;

  if (action === 'tracks') {
    try {
      const controller = new AbortController();
      const upstream = await fetch(targetStreamUrl, {
        headers: { 'Range': 'bytes=0-3145728' }, // Fetch first 3MB to get headers
        signal: controller.signal
      });

      if (!upstream.ok) {
        res.statusCode = upstream.status;
        return res.end(JSON.stringify([]));
      }

      const parser = new SubtitleParser();
      let resolved = false;

      const tracksPromise = new Promise((resolve) => {
        parser.once('tracks', (tracks) => {
          resolved = true;
          controller.abort(); // Cancel the remaining download immediately
          resolve(tracks);
        });

        // Safety timeout of 3.5 seconds
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            controller.abort();
            resolve([]);
          }
        }, 3500);
      });

      const reader = upstream.body.getReader();
      try {
        while (!resolved) {
          const { done, value } = await reader.read();
          if (done) break;
          parser.write(Buffer.from(value));
        }
      } catch (err) {
        // Abort controller cancels fetch, which throws an error we ignore here
      }

      const tracks = await tracksPromise;

      // Filter and map tracks
      const formattedTracks = tracks
        .filter(t => t.type === 'utf8' || t.type === 'ass' || t.type === 'ssa')
        .map((t, idx) => {
          let name = `Subtítulo ${idx + 1}`;
          if (t.language) {
            const langUpper = t.language.toUpperCase();
            if (langUpper === 'SPA') name = 'Español';
            else if (langUpper === 'ENG') name = 'English';
            else name = `Idioma: ${langUpper}`;
          }
          return {
            id: t.number,
            name: name,
            lang: t.language || 'und',
            codec: t.type
          };
        });

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(formattedTracks));
    } catch (error) {
      console.error('Error fetching tracks:', error);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify([]));
    }
  }

  if (action === 'vtt') {
    if (!track) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Missing track number' }));
    }

    const trackNum = parseInt(track, 10);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.write('WEBVTT\n\n');

    try {
      const upstream = await fetch(targetStreamUrl);
      if (!upstream.ok) {
        return res.end();
      }

      const parser = new SubtitleParser();

      // Formatter helper for WebVTT timestamp: HH:MM:SS.mmm
      const formatVttTime = (ms) => {
        const hrs = Math.floor(ms / 3600000);
        const mins = Math.floor((ms % 3600000) / 60000);
        const secs = Math.floor((ms % 60000) / 1000);
        const msec = ms % 1000;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${msec.toString().padStart(3, '0')}`;
      };

      parser.on('subtitle', (subtitle, currentTrackNum) => {
        if (currentTrackNum === trackNum) {
          const start = formatVttTime(subtitle.time);
          const end = formatVttTime(subtitle.time + subtitle.duration);
          let text = subtitle.text.trim();
          // Remove Matroska/ASS style tags like {\pos(x,y)} or {\i1}
          text = text.replace(/\{[^}]+\}/g, '');
          // Replace Matroska ASS newline \N or \n with a real VTT newline
          text = text.replace(/\\N/gi, '\n');
          res.write(`${start} --> ${end}\n${text}\n\n`);
        }
      });

      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.write(Buffer.from(value));
      }

      return res.end();
    } catch (error) {
      console.error('Error serving VTT:', error);
      return res.end();
    }
  }

  res.statusCode = 400;
  return res.end(JSON.stringify({ error: 'Invalid action parameter' }));
}
