import { neon } from '@neondatabase/serverless';

/**
 * Serverless API Route for Watch History in Neon PostgreSQL
 * Only stores VOD Movies and Series episodes left in-progress ("a medias").
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(500).json({ error: 'DATABASE_URL environment variable is missing' });
  }

  try {
    const sql = neon(databaseUrl);

    // Auto-create watch_history table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS watch_history (
        id VARCHAR(255) PRIMARY KEY,
        item_id VARCHAR(255) NOT NULL,
        item_type VARCHAR(50) NOT NULL,
        title TEXT NOT NULL,
        subtitle TEXT,
        poster TEXT,
        stream_url TEXT NOT NULL,
        progress_seconds FLOAT DEFAULT 0,
        duration_seconds FLOAT DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // GET /api/history -> Fetch in-progress movies and series
    if (req.method === 'GET') {
      const history = await sql`
        SELECT * FROM watch_history 
        WHERE item_type IN ('vod', 'series')
          AND progress_seconds > 10
          AND (duration_seconds = 0 OR progress_seconds < (duration_seconds - 30))
        ORDER BY updated_at DESC 
        LIMIT 15;
      `;
      return res.status(200).json({ success: true, history });
    }

    // POST /api/history -> Upsert or Delete watch progress
    if (req.method === 'POST') {
      const {
        item_id,
        item_type = 'vod',
        title,
        subtitle,
        poster,
        stream_url,
        progress_seconds,
        duration_seconds,
      } = req.body || {};

      if (!item_id || !stream_url) {
        return res.status(400).json({ error: 'item_id and stream_url are required' });
      }

      // Ignore Live TV channels
      if (item_type === 'live') {
        return res.status(200).json({ success: true, message: 'Live TV not stored in history' });
      }

      const compositeId = `${item_type}_${item_id}`;

      const isFinished = duration_seconds > 0 && progress_seconds >= (duration_seconds - 30);
      const isTooShort = progress_seconds <= 10;

      // Delete if finished or too short
      if (isFinished || isTooShort) {
        await sql`DELETE FROM watch_history WHERE id = ${compositeId};`;
        return res.status(200).json({ success: true, message: 'Item completed or removed from history' });
      }

      // Upsert in-progress item
      await sql`
        INSERT INTO watch_history (
          id, item_id, item_type, title, subtitle, poster, stream_url, progress_seconds, duration_seconds, updated_at
        ) VALUES (
          ${compositeId}, ${String(item_id)}, ${String(item_type)}, ${title || 'Sin Título'}, ${subtitle || ''}, 
          ${poster || ''}, ${stream_url}, ${Number(progress_seconds) || 0}, ${Number(duration_seconds) || 0}, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          subtitle = EXCLUDED.subtitle,
          poster = EXCLUDED.poster,
          stream_url = EXCLUDED.stream_url,
          progress_seconds = EXCLUDED.progress_seconds,
          duration_seconds = EXCLUDED.duration_seconds,
          updated_at = NOW();
      `;

      return res.status(200).json({ success: true, message: 'Progress saved' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('Neon DB API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Database Error' });
  }
}
