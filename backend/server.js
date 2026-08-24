process.on('uncaughtException', (err) => { console.error('[Server Warning]', err ? (err.message || err) : err); });
process.on('unhandledRejection', (reason) => { console.error('[Server Warning]', reason ? (reason.message || reason) : reason); });
const xtreamApiCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
function getCachedResponse(cacheKey) { if (xtreamApiCache.has(cacheKey)) { const { data, timestamp, contentType } = xtreamApiCache.get(cacheKey); if (Date.now() - timestamp < CACHE_TTL_MS) { return { data, contentType }; } xtreamApiCache.delete(cacheKey); } return null; }
function setCachedResponse(cacheKey, data, contentType) { xtreamApiCache.set(cacheKey, { data, contentType, timestamp: Date.now() }); if (xtreamApiCache.size > 200) { const oldestKey = xtreamApiCache.keys().next().value; xtreamApiCache.delete(oldestKey); } }
import express from 'express';
import { spawn } from 'child_process';
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

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'streamtv-super-secret-key-12345';
const IPTV_SERVER = (process.env.VITE_IPTV_SERVER || 'http://superflash.ovh:80').replace(/\/+$/, '');
const IPTV_USER = process.env.VITE_IPTV_USER || 'astrotv0907';
const IPTV_PASS = process.env.VITE_IPTV_PASS || 'sYeTeAwMHy';
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

    // For media streaming endpoints (/api_stream, /api_hlsr, /api_subtitles),
    // valid signed JWT is sufficient to prevent DB latency or 403 stalls during playback
    if (req.path.startsWith('/api_stream') || req.path.startsWith('/api_hlsr') || req.path.startsWith('/api_subtitles')) {
      req.user = tokenUser;
      return next();
    }

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
      req.user = tokenUser;
      next();
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

      // Handle temporary 429 Too Many Requests rate-limiting from IPTV provider
      if (upstream.status === 429) {
        console.warn(`[Failover] Server ${server.name} rate-limited (429). Retrying after 1s delay...`);
        await new Promise(r => setTimeout(r, 1000));
        const retryUpstream = await fetch(targetUrl, { method, headers });
        if (retryUpstream.ok || retryUpstream.status !== 429) {
          return { upstream: retryUpstream, server, targetUrl };
        }
      }

      if (upstream.ok || (upstream.status >= 400 && upstream.status < 500 && upstream.status !== 429)) {
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

  const cacheKey = JSON.stringify({ action, queryParams });
  const cached = getCachedResponse(cacheKey);
  if (cached) {
    if (cached.contentType && cached.contentType.includes('application/json')) {
      return res.status(200).json(cached.data);
    }
    return res.status(200).send(cached.data);
  }

  try {
    const { upstream } = await executeIPTVRequest((server) => ({
      path: 'player_api.php',
      queryParams: { action, ...queryParams }
    }));

    const contentType = upstream.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await upstream.json();
      setCachedResponse(cacheKey, data, contentType);
      res.status(200).json(data);
    } else {
      const text = await upstream.text();
      setCachedResponse(cacheKey, text, contentType);
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

const subtitleVttCache = new Map();

async function getOrExtractVTT(pathType, id, ext, trackIdx, startTimeSec = 0) {
  const cacheKey = `${pathType}_${id}_${trackIdx}_${startTimeSec}`;
  if (subtitleVttCache.has(cacheKey)) {
    return await subtitleVttCache.get(cacheKey);
  }

  const promise = (async () => {
    try {
      let upstreamRes = await executeIPTVRequest((server) => ({
        path: `${pathType}/${server.username}/${server.password}/${id}.${ext}`,
        skipAuth: true
      }));

      if (!upstreamRes.upstream.ok && ext !== 'mkv') {
        upstreamRes = await executeIPTVRequest((server) => ({
          path: `${pathType}/${server.username}/${server.password}/${id}.mkv`,
          skipAuth: true
        }));
      }

      const { targetUrl } = upstreamRes;
      const ffmpegPath = ffmpegInstaller.path;

      const ffmpegArgs = [
        '-hide_banner',
        '-loglevel', 'error'
      ];

      if (startTimeSec > 0) {
        ffmpegArgs.push('-ss', String(startTimeSec));
      }

      ffmpegArgs.push(
        '-i', targetUrl,
        '-vn',
        '-an',
        '-map', `0:s:${trackIdx}?`,
        '-c:s', 'webvtt',
        '-f', 'webvtt',
        '-'
      );

      let vttData = 'WEBVTT\n\n';
      const ffmpegProc = spawn(ffmpegPath, ffmpegArgs);

      ffmpegProc.stdout.on('data', (chunk) => {
        vttData += chunk.toString('utf8');
      });

      // 90s timeout for full 0-start extraction, 25s timeout for specific seek time
      const timeoutMs = startTimeSec > 0 ? 25000 : 90000;

      await new Promise((resolve) => {
        const killTimeout = setTimeout(() => {
          try { ffmpegProc.kill('SIGKILL'); } catch (_) {}
          resolve();
        }, timeoutMs);

        ffmpegProc.on('close', () => {
          clearTimeout(killTimeout);
          resolve();
        });
      });

      return vttData;
    } catch (e) {
      return 'WEBVTT\n\n';
    }
  })();

  subtitleVttCache.set(cacheKey, promise);
  return await promise;
}

// Subtitles Extractor Proxy
app.get('/api_subtitles', authenticateToken, async (req, res) => {
  const { id, type, action, track, ext = 'mkv', startTime = '0' } = req.query;
  const pathType = (type === 'vod' || type === 'movie') ? 'movie' : 'series';
  const startTimeSec = Math.max(0, parseInt(startTime || '0', 10));

  if (action === 'tracks') {
    try {
      const { upstream } = await executeIPTVRequest((server) => ({
        path: `${pathType}/${server.username}/${server.password}/${id}.${ext}`,
        headers: { 'Range': 'bytes=0-12582912' },
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

      // Pre-fetch all subtitle tracks in the background asynchronously from start (0s)
      if (Array.isArray(tracks) && tracks.length > 0) {
        tracks.forEach((_, idx) => {
          getOrExtractVTT(pathType, id, ext, idx, 0).catch(() => {});
        });
      }
    } catch (e) {
      res.status(200).json([]);
    }
    return;
  }

  if (action === 'vtt') {
    const trackIdx = parseInt(track || '0', 10);
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');

    try {
      const vttData = await getOrExtractVTT(pathType, id, ext, trackIdx, startTimeSec);
      res.end(vttData);
    } catch (e) {
      res.end('WEBVTT\n\n');
    }
    return;
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
    const isMkv = file.endsWith('.mkv') || file.endsWith('.avi') || file.endsWith('.ts');
    
    if (idMatch) {
      if (type === 'movie' || type === 'vod') {
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

          codecName = vCodec || aCodec;
        } catch (e) {
          console.error('[Stream] Could not fetch VOD info:', e.message);
        }
      }

      // Default audio transcoding for MKV files (almost always contain AC3 audio incompatible with Chrome)
      if (isMkv && !audioNeedsTranscode && !videoNeedsTranscode) {
        audioNeedsTranscode = true;
      }

      needsTranscoding = audioNeedsTranscode || videoNeedsTranscode;
      codecName = codecName || (isMkv ? 'ac3/mkv' : 'passthrough');
      console.log(`[Stream] Stream codecs for ${file} (${type}) → transcodeVideo:${videoNeedsTranscode} transcodeAudio:${audioNeedsTranscode}`);
    }

    // 2. Transcode incompatible codecs using FFmpeg on-the-fly
    if (needsTranscoding && req.method === 'GET') {
      // Cancel the upstream body — FFmpeg will open its own connection
      try { upstream.body?.cancel(); } catch (_) {}

      const startTime = parseFloat(req.query.startTime || req.query.ss || 0);
      console.log(`[Transcoding] Starting FFmpeg for '${codecName}' on ${file} at t=${startTime}s (video:${videoNeedsTranscode ? 'libx264' : 'copy'} audio:${audioNeedsTranscode ? 'aac' : 'copy'})`);
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache');
      
      const command = ffmpeg(targetUrl);
      if (startTime > 0) {
        command.seekInput(startTime);
      }
      command
        .videoCodec(videoNeedsTranscode ? 'libx264' : 'copy')
        .audioCodec(audioNeedsTranscode ? 'aac' : 'copy')
        .format('mp4')
        .outputOptions([
          '-map', '0:v:0',
          '-map', '0:a:0?',
          '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
          '-min_frag_duration', '2000000', // Enforce tight 2-second fragment size for instant HTTP delivery
          ...(videoNeedsTranscode ? ['-preset', 'fast', '-crf', '23'] : [])
        ]);

      if (audioNeedsTranscode) {
        command.audioBitrate('192k').audioChannels(2);
      }

      command
        .on('start', (cmd) => console.log('[Transcoding] FFmpeg started:', cmd.slice(0, 160)))
        .on('error', (err) => {
          console.error('[Transcoding] FFmpeg error:', err.message);
          try { res.end(); } catch (_) {}
        })
        .on('end', () => {
          try { res.end(); } catch (_) {}
        });

      req.on('close', () => {
        if (!res.writableEnded) {
          try { command.kill('SIGTERM'); } catch (_) {}
        }
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
