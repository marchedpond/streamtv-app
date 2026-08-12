import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';
import { SubtitleParser } from 'matroska-subtitles';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { Readable } from 'stream';
import { Resend } from 'resend';

// Set ffmpeg path to the bundled binary from @ffmpeg-installer/ffmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const resend = new Resend(process.env.RESEND_API_KEY);

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'streamtv-super-secret-key-12345';
const IPTV_SERVER = (process.env.VITE_IPTV_SERVER || 'http://espartanos.live:8080').replace(/\/+$/, '');
const IPTV_USER = process.env.VITE_IPTV_USER || 'JosueMejia';
const IPTV_PASS = process.env.VITE_IPTV_PASS || 'PPw3tAhK4P';
const DATABASE_URL = process.env.DATABASE_URL;

// Database Connection helper
const getSql = () => {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is missing');
  }
  return neon(DATABASE_URL);
};

// Initialize DB Tables
async function initDatabase() {
  if (!DATABASE_URL) return;
  try {
    const sql = getSql();
    // Create Users Table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        status VARCHAR(50) DEFAULT 'pending',
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Ensure name column exists in users table (migration)
    await sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    `;

    // Create Admin User if not exists
    const adminExists = await sql`SELECT * FROM users WHERE role = 'admin' LIMIT 1;`;
    if (adminExists.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await sql`
        INSERT INTO users (email, password_hash, role, status)
        VALUES ('admin@streamtv.com', ${hash}, 'admin', 'approved');
      `;
      console.log('Default Admin Account Created: admin@streamtv.com / admin123');
    }

    // Create/Migrate watch_history to include user_id
    await sql`
      CREATE TABLE IF NOT EXISTS watch_history (
        id VARCHAR(255) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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

    // Migration to ensure user_id column exists in watch_history table
    await sql`
      ALTER TABLE watch_history ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    `;

    // Create IPTV Servers Table
    await sql`
      CREATE TABLE IF NOT EXISTS iptv_servers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        username VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        priority INTEGER DEFAULT 1
      );
    `;

    // Seed default server if empty
    const serversCount = await sql`SELECT count(*) FROM iptv_servers;`;
    if (parseInt(serversCount[0].count, 10) === 0 && IPTV_SERVER && IPTV_USER && IPTV_PASS) {
      await sql`
        INSERT INTO iptv_servers (name, url, username, password, is_active, priority)
        VALUES ('Servidor Primario', ${IPTV_SERVER}, ${IPTV_USER}, ${IPTV_PASS}, true, 1);
      `;
      console.log('Seeded default IPTV server from env variables.');
    }
    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Database initialization error:', err.message);
  }
}

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  // Fallback to query parameter (e.g. for HTML5 <track> elements)
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) return res.status(401).json({ error: 'No autorizado' });

  jwt.verify(token, JWT_SECRET, async (err, tokenUser) => {
    if (err) return res.status(403).json({ error: 'Token inválido o expirado' });

    try {
      const sql = getSql();
      const users = await sql`SELECT * FROM users WHERE id = ${tokenUser.id} LIMIT 1;`;
      if (users.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

      const user = users[0];
      if (user.status !== 'approved') {
        return res.status(403).json({ error: 'Cuenta pendiente de aprobación o suspendida' });
      }

      // Check Expiration
      if (user.expires_at && new Date(user.expires_at) < new Date()) {
        return res.status(403).json({ error: 'Tu suscripción/acceso beta ha vencido' });
      }

      req.user = user;
      next();
    } catch (e) {
      return res.status(500).json({ error: 'Error de servidor al validar usuario' });
    }
  });
};

// Admin Middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso exclusivo para administradores' });
  }
  next();
};

/**
 * ---------------- AUTH ROUTES ----------------
 */

// Register Account
app.post('/api/auth/register', async (req, res) => {
  const { email, name } = req.body;
  if (!email || !name) return res.status(400).json({ error: 'Nombre y correo requeridos' });

  try {
    const sql = getSql();
    const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()} LIMIT 1;`;
    if (existing.length > 0) return res.status(400).json({ error: 'El correo ya está registrado' });

    // Autogenerate a secure password of 8 characters
    const generatedPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 10);
    const passwordHash = await bcrypt.hash(generatedPassword, 10);
    
    // Beta/Trial rules: Default to trial with 6 hours expiration, approved status
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 Hours

    const result = await sql`
      INSERT INTO users (email, name, password_hash, role, status, expires_at)
      VALUES (${email.toLowerCase()}, ${name}, ${passwordHash}, 'trial', 'approved', ${expiresAt})
      RETURNING id, email, name, role, status, expires_at;
    `;
    
    const user = result[0];
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });

    // Send Welcome Email with generated password using Resend
    try {
      await resend.emails.send({
        from: 'StreamTV <onboarding@resend.dev>',
        to: email.toLowerCase(),
        subject: '¡Bienvenido a StreamTV! Tus datos de acceso',
        html: `
          <div style="font-family: sans-serif; max-width: 500px; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #e50914;">¡Hola ${name}!</h2>
            <p>Tu cuenta de StreamTV ha sido creada con éxito en el modo de prueba de <strong>6 horas</strong>.</p>
            <p>Aquí tienes tus credenciales de inicio de sesión:</p>
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #ddd; margin: 15px 0;">
              <p style="margin: 5px 0;"><strong>Usuario (Correo):</strong> ${email.toLowerCase()}</p>
              <p style="margin: 5px 0;"><strong>Contraseña:</strong> <span style="font-family: monospace; font-size: 16px; font-weight: bold; color: #333;">${generatedPassword}</span></p>
            </div>
            <p style="font-size: 12px; color: #777;">Si deseas extender tu acceso, ponte en contacto con tu administrador familiar.</p>
          </div>
        `
      });
    } catch (emailErr) {
      console.error('Failed to send welcome email:', emailErr.message);
    }

    res.status(201).json({ success: true, user, token });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'El correo electrónico es requerido' });

  try {
    const sql = getSql();
    const existing = await sql`SELECT id, name FROM users WHERE email = ${email.toLowerCase()} LIMIT 1;`;
    if (existing.length === 0) return res.status(404).json({ error: 'No existe una cuenta registrada con este correo' });

    const user = existing[0];
    // Generate new secure password
    const newPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 10);
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password in DB
    await sql`
      UPDATE users 
      SET password_hash = ${passwordHash}
      WHERE id = ${user.id};
    `;

    // Send email with new password using Resend
    try {
      await resend.emails.send({
        from: 'StreamTV <onboarding@resend.dev>',
        to: email.toLowerCase(),
        subject: 'Tu nueva contraseña de StreamTV',
        html: `
          <div style="font-family: sans-serif; max-width: 500px; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #e50914;">Restablecimiento de Contraseña</h2>
            <p>Hola <strong>${user.name || 'Usuario'}</strong>,</p>
            <p>Has solicitado restablecer tu contraseña. Hemos generado una nueva credencial segura para ti:</p>
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #ddd; margin: 15px 0;">
              <p style="margin: 5px 0;"><strong>Contraseña Temporal:</strong> <span style="font-family: monospace; font-size: 16px; font-weight: bold; color: #333;">${newPassword}</span></p>
            </div>
            <p>Te recomendamos ingresar con esta contraseña y cambiarla una vez que estés dentro de la aplicación.</p>
          </div>
        `
      });
    } catch (emailErr) {
      console.error('Failed to send reset email:', emailErr.message);
    }

    res.status(200).json({ success: true, message: 'Se ha enviado una nueva contraseña a tu correo electrónico' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Error al procesar recuperación de contraseña' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Correo y contraseña requeridos' });

  try {
    const sql = getSql();
    const result = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()} LIMIT 1;`;
    if (result.length === 0) return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });

    const user = result[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });

    if (user.status !== 'approved') {
      return res.status(403).json({ error: 'Tu cuenta está pendiente de aprobación' });
    }

    if (user.expires_at && new Date(user.expires_at) < new Date()) {
      return res.status(403).json({ error: 'Tu acceso de prueba ha expirado' });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        expires_at: user.expires_at,
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// Get Profile Info
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      status: req.user.status,
      expires_at: req.user.expires_at,
    }
  });
});

/**
 * ---------------- ADMIN ROUTES ----------------
 */

// List Users
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const sql = getSql();
    const users = await sql`
      SELECT id, email, role, status, expires_at, created_at 
      FROM users 
      ORDER BY id ASC;
    `;
    res.status(200).json({ success: true, users });
  } catch (err) {
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
});

// Update User (Role, Status, Expiration)
app.put('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { role, status, expires_at } = req.body;

  try {
    const sql = getSql();
    const targetId = parseInt(id, 10);

    // Prevent de-promoting the last admin
    if (targetId === req.user.id && role && role !== 'admin') {
      return res.status(400).json({ error: 'No puedes quitarte el rol de admin a ti mismo' });
    }

    let expirationVal = expires_at ? new Date(expires_at) : null;
    if (role === 'admin') {
      expirationVal = null; // Admin accounts are always permanent
    }

    const result = await sql`
      UPDATE users 
      SET 
        role = COALESCE(${role}, role),
        status = COALESCE(${status}, status),
        expires_at = ${expirationVal}
      WHERE id = ${targetId}
      RETURNING id, email, role, status, expires_at;
    `;

    if (result.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.status(200).json({ success: true, user: result[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// Delete User
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const sql = getSql();
    const targetId = parseInt(id, 10);
    if (targetId === req.user.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });

    await sql`DELETE FROM users WHERE id = ${targetId};`;
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// List IPTV Servers
app.get('/api/admin/servers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const sql = getSql();
    const servers = await sql`SELECT * FROM iptv_servers ORDER BY priority ASC, id ASC;`;
    res.status(200).json({ success: true, servers });
  } catch (err) {
    res.status(500).json({ error: 'Error al listar servidores IPTV' });
  }
});

// Add IPTV Server
app.post('/api/admin/servers', authenticateToken, requireAdmin, async (req, res) => {
  const { name, url, username, password, is_active, priority } = req.body;
  if (!name || !url || !username || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }
  try {
    const sql = getSql();
    const result = await sql`
      INSERT INTO iptv_servers (name, url, username, password, is_active, priority)
      VALUES (${name}, ${url.replace(/\/+$/, '')}, ${username}, ${password}, ${is_active !== false}, ${parseInt(priority, 10) || 1})
      RETURNING *;
    `;
    res.status(201).json({ success: true, server: result[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al agregar servidor IPTV' });
  }
});

// Update IPTV Server
app.put('/api/admin/servers/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, url, username, password, is_active, priority } = req.body;
  try {
    const sql = getSql();
    const targetId = parseInt(id, 10);
    const result = await sql`
      UPDATE iptv_servers
      SET
        name = COALESCE(${name}, name),
        url = COALESCE(${url ? url.replace(/\/+$/, '') : null}, url),
        username = COALESCE(${username}, username),
        password = COALESCE(${password}, password),
        is_active = COALESCE(${is_active}, is_active),
        priority = COALESCE(${priority}, priority)
      WHERE id = ${targetId}
      RETURNING *;
    `;
    if (result.length === 0) return res.status(404).json({ error: 'Servidor no encontrado' });
    res.status(200).json({ success: true, server: result[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar servidor IPTV' });
  }
});

// Delete IPTV Server
app.delete('/api/admin/servers/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const sql = getSql();
    await sql`DELETE FROM iptv_servers WHERE id = ${parseInt(id, 10)};`;
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar servidor IPTV' });
  }
});

/**
 * ---------------- HISTORY ROUTES ----------------
 */

app.get('/api/history', authenticateToken, async (req, res) => {
  try {
    const sql = getSql();
    const history = await sql`
      SELECT * FROM watch_history 
      WHERE user_id = ${req.user.id}
        AND item_type IN ('vod', 'series')
        AND progress_seconds >= 3
        AND (duration_seconds = 0 OR progress_seconds < (duration_seconds - 20))
      ORDER BY updated_at DESC 
      LIMIT 20;
    `;
    res.status(200).json({ success: true, history });
  } catch (err) {
    console.error('Error in GET /api/history:', err.message);
    res.status(500).json({ error: 'Error al cargar historial' });
  }
});

app.post('/api/history', authenticateToken, async (req, res) => {
  const { item_id, item_type = 'vod', title, subtitle, poster, stream_url, progress_seconds, duration_seconds } = req.body;
  if (!item_id || !title || !stream_url) {
    return res.status(400).json({ error: 'Missing history info' });
  }

  try {
    const sql = getSql();
    const rowId = `${req.user.id}_${item_type}_${item_id}`;

    // If progress is near completion, delete the history record
    if (duration_seconds > 0 && progress_seconds >= duration_seconds - 20) {
      await sql`DELETE FROM watch_history WHERE id = ${rowId};`;
      return res.status(200).json({ success: true, deleted: true });
    }

    await sql`
      INSERT INTO watch_history (id, user_id, item_id, item_type, title, subtitle, poster, stream_url, progress_seconds, duration_seconds, updated_at)
      VALUES (${rowId}, ${req.user.id}, ${item_id}, ${item_type}, ${title}, ${subtitle}, ${poster}, ${stream_url}, ${progress_seconds}, ${duration_seconds}, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        progress_seconds = EXCLUDED.progress_seconds,
        duration_seconds = EXCLUDED.duration_seconds,
        updated_at = CURRENT_TIMESTAMP;
    `;
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error in POST /api/history:', err.message);
    res.status(500).json({ error: 'Error al guardar progreso' });
  }
});

app.delete('/api/history', authenticateToken, async (req, res) => {
  const { item_id, item_type } = req.body;
  try {
    const sql = getSql();
    const rowId = `${req.user.id}_${item_type}_${item_id}`;
    await sql`DELETE FROM watch_history WHERE id = ${rowId};`;
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error in DELETE /api/history:', err.message);
    res.status(500).json({ error: 'Error al borrar historial' });
  }
});

// Helper for failover: loops through active servers and executes request
async function executeIPTVRequest(requestBuilderFn) {
  let servers = [];
  try {
    const sql = getSql();
    servers = await sql`SELECT * FROM iptv_servers WHERE is_active = true ORDER BY priority ASC, id ASC;`;
  } catch (err) {
    console.error('Failed to query servers for failover:', err.message);
  }

  if (servers.length === 0) {
    servers = [{
      name: 'Fallback Env Server',
      url: IPTV_SERVER,
      username: IPTV_USER,
      password: IPTV_PASS
    }];
  }

  for (let i = 0; i < servers.length; i++) {
    const server = servers[i];
    try {
      const { path, queryParams = {}, method = 'GET', headers = {}, skipAuth = false } = requestBuilderFn(server);

      let targetUrl;
      if (skipAuth) {
        // Stream URLs: credentials already embedded in the path (Xtream Codes standard)
        // Don't add ?username=...&password=... to avoid double-auth issues
        const extraParams = Object.entries(queryParams)
          .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
          .join('&');
        targetUrl = `${server.url}/${path.replace(/^\/+/, '')}${extraParams ? '?' + extraParams : ''}`;
      } else {
        const separator = path.includes('?') ? '&' : '?';
        const authParams = `username=${encodeURIComponent(server.username)}&password=${encodeURIComponent(server.password)}`;
        const extraParams = Object.entries(queryParams)
          .map(([k, v]) => `&${k}=${encodeURIComponent(v)}`)
          .join('');
        targetUrl = `${server.url}/${path.replace(/^\/+/, '')}${separator}${authParams}${extraParams}`;
      }

      console.log(`[Failover] Trying server ${server.name} (${server.url})...`);

      const upstream = await fetch(targetUrl, { method, headers });
      if (upstream.ok || (upstream.status >= 400 && upstream.status < 500)) {
        return { upstream, server, targetUrl };
      }
      console.warn(`[Failover] Server ${server.name} returned status ${upstream.status}. Retrying next...`);
    } catch (err) {
      console.error(`[Failover] Server ${server.name} request failed:`, err.message);
      if (i === servers.length - 1) {
        throw err;
      }
    }
  }
  throw new Error('All configured IPTV servers failed to respond.');
}

// General Action Proxy
app.get('/api_proxy', authenticateToken, async (req, res) => {
  const action = req.query.action || '';
  const queryParams = { ...req.query };
  delete queryParams.action;
  delete queryParams.token;

  try {
    const { upstream } = await executeIPTVRequest((server) => ({
      path: 'player_api.php',
      queryParams: { action, ...queryParams }
    }));

    const contentType = upstream.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await upstream.json();
      res.status(200).json(data);
    } else {
      const text = await upstream.text();
      res.status(200).send(text);
    }
  } catch (err) {
    res.status(500).json({ error: 'Error de conexión con todos los servidores de televisión' });
  }
});

// Resource General Proxy
app.get('/api_raw_proxy', authenticateToken, async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).end('Missing url');

  try {
    const upstream = await fetch(url, { headers: { 'Range': req.headers.range || '' } });
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    res.status(500).end();
  }
});

// HLS Segment Redirector Proxy
app.get('/api_hlsr', authenticateToken, async (req, res) => {
  const { host, file } = req.query;
  if (!host || !file) return res.status(400).end('Missing params');

  const targetUrl = `${host}/hlsr/${file}`;
  try {
    const upstream = await fetch(targetUrl);
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/mp2t');
    if (upstream.headers.get('content-length')) {
      res.setHeader('Content-Length', upstream.headers.get('content-length'));
    }
    const nodeStream = Readable.fromWeb(upstream.body);
    nodeStream.on('error', () => {
      try { res.end(); } catch (_) {}
    });
    nodeStream.pipe(res);
  } catch (err) {
    res.status(500).end();
  }
});

// Subtitles Extractor Proxy
app.get('/api_subtitles', authenticateToken, async (req, res) => {
  const { id, type, action, track, ext = 'mkv' } = req.query;
  const pathType = (type === 'vod' || type === 'movie') ? 'movie' : 'series';

  if (action === 'tracks') {
    try {
      const { upstream } = await executeIPTVRequest((server) => ({
        path: `${pathType}/${server.username}/${server.password}/${id}.${ext}`,
        headers: { 'Range': 'bytes=0-3145728' },
        skipAuth: true
      }));

      if (!upstream.ok) return res.status(upstream.status).json([]);
      const parser = new SubtitleParser();
      let resolved = false;

      const tracksPromise = new Promise((resolve) => {
        parser.once('tracks', (tracks) => {
          resolved = true;
          resolve(tracks);
        });
        setTimeout(() => {
          if (!resolved) resolve([]);
        }, 6000);
      });

      const reader = upstream.body.getReader();
      while (!resolved) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.write(Buffer.from(value));
      }

      const tracks = await tracksPromise;
      res.status(200).json(tracks);
    } catch (e) {
      res.status(200).json([]);
    }
    return;
  }

  if (action === 'vtt') {
    const trackNum = parseInt(track || '0', 10);
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.write('WEBVTT\n\n');

    try {
      const { upstream } = await executeIPTVRequest((server) => ({
        path: `${pathType}/${server.username}/${server.password}/${id}.${ext}`,
        headers: { 'Range': 'bytes=0-67108864' },
        skipAuth: true
      }));

      if (!upstream.ok) return res.end();
      const parser = new SubtitleParser();

      const formatVttTime = (ms) => {
        const date = new Date(ms);
        const hours = String(Math.floor(ms / 3600000)).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');
        const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0');
        return `${hours}:${minutes}:${seconds}.${milliseconds}`;
      };

      parser.on('subtitle', (subtitle, currentTrackNum) => {
        if (currentTrackNum === trackNum) {
          const start = formatVttTime(subtitle.time);
          const end = formatVttTime(subtitle.time + subtitle.duration);
          let text = subtitle.text.trim();
          text = text.replace(/\{[^}]+\}/g, '').replace(/<[^>]+>/g, '');
          text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          text = text.replace(/\\[Nn]/g, '\n');
          res.write(`${start} --> ${end}\n${text}\n\n`);
        }
      });

      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.write(Buffer.from(value));
      }
      res.end();
    } catch (e) {
      res.end();
    }
  }
});

// Dynamic Video Streamer Proxy with Real-Time Audio Transcoding
app.get('/api_stream/:type/:file', authenticateToken, async (req, res) => {
  const { type, file } = req.params;
  const isM3u8 = file.endsWith('.m3u8');

  try {
    const upstreamHeaders = {};
    if (req.headers.range) {
      upstreamHeaders['range'] = req.headers.range;
    }

    const { upstream, server, targetUrl } = await executeIPTVRequest((server) => ({
      path: `${type}/${server.username}/${server.password}/${file}`,
      headers: upstreamHeaders,
      method: req.method,
      skipAuth: true  // credentials already embedded in path
    }));

    if (!upstream.ok) {
      console.error(`[Stream] IPTV server returned ${upstream.status} for ${file}`);
      return res.status(upstream.status).end();
    }

    if (isM3u8) {
      let m3u8Text = await upstream.text();
      const finalUrl = new URL(upstream.url);
      const encodedOrigin = encodeURIComponent(finalUrl.origin);
      
      const token = req.query.token || '';
      m3u8Text = m3u8Text.replace(/\/hlsr\//g, `/api_hlsr?token=${token}&host=${encodedOrigin}&file=`);
      res.setHeader('Content-Type', 'application/x-mpegURL');
      return res.status(200).send(m3u8Text);
    }

    // 1. Fetch VOD info to check codecs
    let needsTranscoding = false;
    let audioNeedsTranscode = false;
    let videoNeedsTranscode = false;
    let codecName = '';
    const idMatch = file.match(/^(\d+)\.\w+$/);
    
    if (idMatch && type === 'movie') {
      const infoUrl = `${server.url}/player_api.php?username=${encodeURIComponent(server.username)}&password=${encodeURIComponent(server.password)}&action=get_vod_info&vod_id=${idMatch[1]}`;
      try {
        const infoRes = await fetch(infoUrl);
        const infoData = await infoRes.json();
        const aCodec = (infoData.info?.audio?.codec_name || infoData.audio?.codec_name || '').toLowerCase();
        const vCodec = (infoData.info?.video?.codec_name || infoData.video?.codec_name || '').toLowerCase();

        // Audio: AC3, E-AC3 (Dolby), DTS → not supported by Chrome
        if (aCodec && (aCodec.includes('ac3') || aCodec.includes('ac-3') || aCodec.includes('dts') || aCodec.includes('eac3') || aCodec.includes('e-ac-3'))) {
          audioNeedsTranscode = true;
        }
        // Video: HEVC / H.265 → not supported by Chrome on most systems
        if (vCodec && (vCodec.includes('hevc') || vCodec.includes('h265') || vCodec.includes('h.265'))) {
          videoNeedsTranscode = true;
        }

        needsTranscoding = audioNeedsTranscode || videoNeedsTranscode;
        codecName = vCodec || aCodec;
        console.log(`[Stream] VOD codecs → video:'${vCodec}' audio:'${aCodec}' | transcodeVideo:${videoNeedsTranscode} transcodeAudio:${audioNeedsTranscode}`);
      } catch (e) {
        console.error('[Stream] Could not fetch VOD info:', e.message);
      }
    }

    // 2. Transcode incompatible codecs using FFmpeg on-the-fly
    if (needsTranscoding && req.method === 'GET') {
      // Cancel the upstream body — FFmpeg will open its own connection
      try { upstream.body?.cancel(); } catch (_) {}

      console.log(`[Transcoding] Starting FFmpeg for '${codecName}' on ${file} (video:${videoNeedsTranscode ? 'libx264' : 'copy'} audio:${audioNeedsTranscode ? 'aac' : 'copy'})`);
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache');
      
      const command = ffmpeg(targetUrl)
        .videoCodec(videoNeedsTranscode ? 'libx264' : 'copy')
        .audioCodec(audioNeedsTranscode ? 'aac' : 'copy')
        .audioBitrate(audioNeedsTranscode ? '192k' : undefined)
        .audioChannels(audioNeedsTranscode ? 2 : undefined)
        .format('mp4')
        .outputOptions([
          '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
          '-fflags', '+genpts',
          ...(videoNeedsTranscode ? ['-preset', 'fast', '-crf', '23'] : [])
        ])
        .on('start', (cmd) => console.log('[Transcoding] FFmpeg started:', cmd.slice(0, 160)))
        .on('error', (err) => {
          console.error('[Transcoding] FFmpeg error:', err.message);
          try { res.end(); } catch (_) {}
        })
        .on('end', () => {
          try { res.end(); } catch (_) {}
        });

      req.on('close', () => {
        try { command.kill('SIGKILL'); } catch (_) {}
      });

      command.pipe(res, { end: true });
      return;
    }

    // 3. Passthrough if no transcoding needed (or for HEAD requests)
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
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

    const nodeStream = Readable.fromWeb(upstream.body);
    nodeStream.on('error', () => {
      try { res.end(); } catch (_) {}
    });
    nodeStream.pipe(res);
  } catch (err) {
    console.error('Streaming error:', err.message);
    res.status(500).end();
  }
});

// Start Server
app.listen(PORT, async () => {
  console.log(`StreamTV Backend running on port ${PORT}`);
  await initDatabase();
});
