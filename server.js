import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4173;

const TMDB_API = 'https://api.themoviedb.org/3';
const TMDB_KEY = process.env.TMDB_API_KEY || '';
const OMDB_API = 'https://www.omdbapi.com/';
const OMDB_KEY = process.env.OMDB_API_KEY || '';
const EMBED_BASE = 'https://vidsrcme.ru';

const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || '';
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS || '';
const AUTH_ENABLED = Boolean(BASIC_AUTH_USER && BASIC_AUTH_PASS);

function asMediaType(value) {
  return value === 'tv' ? 'tv' : 'movie';
}

app.use(express.json());

// Lets the mobile app (running from a different origin during development
// — Expo web, or a physical device hitting this server's LAN IP) call the
// API. Native fetch on iOS/Android ignores CORS entirely; this only matters
// for browser-based clients.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Optional HTTP Basic Auth, enabled only when BASIC_AUTH_USER/PASS are both
// set. On a private network (LAN, or the Tailscale setup in
// dedicated-server/) leave them unset; when the server is reachable from the
// public internet (see render/), set them — nothing else here authenticates
// callers, so without it anyone with the URL can read/modify watch history
// and spend the TMDB/OMDb quota.
function matchesSecret(provided, expected) {
  // Hash first: timingSafeEqual throws on length mismatch, which would leak
  // the expected length.
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

if (AUTH_ENABLED) {
  app.use((req, res, next) => {
    const [scheme, encoded] = (req.headers.authorization || '').split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const sep = decoded.indexOf(':');
      const user = sep === -1 ? decoded : decoded.slice(0, sep);
      const pass = sep === -1 ? '' : decoded.slice(sep + 1);
      if (matchesSecret(user, BASIC_AUTH_USER) && matchesSecret(pass, BASIC_AUTH_PASS)) return next();
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="simple-streamer"');
    res.status(401).send('Authentication required');
  });
}

// Defense-in-depth alongside the player iframe's sandbox attribute
// (player.html): pins what the page is allowed to frame, and stops the
// embed from learning this app's URL via the Referer header.
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', `frame-src 'self' ${EMBED_BASE}`);
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(express.static(__dirname));

// --- TMDB proxy (keeps the API key server-side) ---

app.get('/api/config', (req, res) => {
  res.json({ tmdbConfigured: Boolean(TMDB_KEY) });
});

app.get('/api/tmdb/*', async (req, res, next) => {
  if (!TMDB_KEY) return res.status(503).json({ error: 'TMDB_API_KEY is not configured on the server' });
  try {
    const url = new URL(TMDB_API + '/' + req.params[0]);
    url.searchParams.set('language', 'en-US');
    for (const [key, value] of Object.entries(req.query)) {
      url.searchParams.set(key, value);
    }
    const headers = { Accept: 'application/json' };
    if (TMDB_KEY.split('.').length === 3 && TMDB_KEY.length > 100) {
      headers.Authorization = 'Bearer ' + TMDB_KEY;
    } else {
      url.searchParams.set('api_key', TMDB_KEY);
    }
    const tmdbRes = await fetch(url, { headers });
    const body = await tmdbRes.json();
    res.status(tmdbRes.status).json(body);
  } catch (err) {
    next(err);
  }
});

// --- OMDb proxy (IMDb / Rotten Tomatoes / Metacritic ratings) ---

app.get('/api/omdb/:imdbId', async (req, res, next) => {
  if (!OMDB_KEY) return res.status(503).json({ error: 'OMDB_API_KEY is not configured on the server' });
  try {
    const url = new URL(OMDB_API);
    url.searchParams.set('i', req.params.imdbId);
    url.searchParams.set('apikey', OMDB_KEY);
    const omdbRes = await fetch(url);
    const body = await omdbRes.json();
    res.status(omdbRes.status).json(body);
  } catch (err) {
    next(err);
  }
});

// --- continue watching ---

app.get('/api/continue-watching', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM continue_watching ORDER BY updated_at DESC');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.get('/api/continue-watching/:type/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM continue_watching WHERE media_type = $1 AND tmdb_id = $2',
      [asMediaType(req.params.type), req.params.id]
    );
    res.json(rows[0] || null);
  } catch (err) {
    next(err);
  }
});

app.post('/api/continue-watching', async (req, res, next) => {
  const { mediaType, tmdbId, imdbId, title, posterPath, season, episode, progress, duration } = req.body || {};
  if (!tmdbId || !title || progress == null || duration == null) {
    return res.status(400).json({ error: 'tmdbId, title, progress and duration are required' });
  }
  try {
    await pool.query(
      `INSERT INTO continue_watching
         (media_type, tmdb_id, imdb_id, title, poster_path, season, episode, progress, duration, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       ON CONFLICT (media_type, tmdb_id) DO UPDATE SET
         imdb_id = EXCLUDED.imdb_id,
         title = EXCLUDED.title,
         poster_path = EXCLUDED.poster_path,
         season = EXCLUDED.season,
         episode = EXCLUDED.episode,
         progress = EXCLUDED.progress,
         duration = EXCLUDED.duration,
         updated_at = now()`,
      [asMediaType(mediaType), tmdbId, imdbId || null, title, posterPath || null, season ?? null, episode ?? null, progress, duration]
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

app.delete('/api/continue-watching/:type/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM continue_watching WHERE media_type = $1 AND tmdb_id = $2', [
      asMediaType(req.params.type),
      req.params.id,
    ]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// --- favorites ---

app.get('/api/favorites', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM favorites ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

app.get('/api/favorites/:type/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM favorites WHERE media_type = $1 AND tmdb_id = $2',
      [asMediaType(req.params.type), req.params.id]
    );
    res.json(rows[0] || null);
  } catch (err) {
    next(err);
  }
});

app.post('/api/favorites', async (req, res, next) => {
  const { mediaType, tmdbId, imdbId, title, posterPath } = req.body || {};
  if (!tmdbId || !title) {
    return res.status(400).json({ error: 'tmdbId and title are required' });
  }
  try {
    await pool.query(
      `INSERT INTO favorites (media_type, tmdb_id, imdb_id, title, poster_path)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (media_type, tmdb_id) DO NOTHING`,
      [asMediaType(mediaType), tmdbId, imdbId || null, title, posterPath || null]
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

app.delete('/api/favorites/:type/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM favorites WHERE media_type = $1 AND tmdb_id = $2', [
      asMediaType(req.params.type),
      req.params.id,
    ]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`simple-streamer listening on http://localhost:${PORT}`);
});
