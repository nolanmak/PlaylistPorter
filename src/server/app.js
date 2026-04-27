import express from 'express';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadState, patchState } from '../spotify/store.js';
import { buildAuthorizeUrl, exchangeCodeForTokens, generateState, REDIRECT_URI } from './auth.js';
import { ProgressBus, attachSseStream } from './progress.js';
import { runImport } from '../spotify/import.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VIEWS = resolve(__dirname, 'views');
const ROOT = resolve(__dirname, '../..');
const EXPORT_PATH = resolve(ROOT, 'data/pandora-export.json');

let activeImport = null;

export function createApp() {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  // In-memory OAuth state per server lifetime — no real auth needed,
  // we're localhost-only and we just need CSRF protection on the callback.
  const oauthStates = new Set();

  async function renderView(name, replacements = {}) {
    let html = await readFile(resolve(VIEWS, name), 'utf8');
    for (const [k, v] of Object.entries(replacements)) {
      html = html.replaceAll(`{{${k}}}`, v);
    }
    return html;
  }

  app.get('/', async (req, res) => {
    const state = await loadState();
    if (!state.clientId || !state.clientSecret) return res.redirect('/setup');
    if (!state.refreshToken) return res.redirect('/login');
    return res.redirect('/dashboard');
  });

  app.get('/setup', async (req, res) => {
    const state = await loadState();
    res.type('html').send(await renderView('setup.html', {
      clientId: state.clientId ?? '',
      redirectUri: REDIRECT_URI,
    }));
  });

  app.post('/setup', async (req, res) => {
    const clientId = (req.body.clientId ?? '').trim();
    const clientSecret = (req.body.clientSecret ?? '').trim();
    if (!clientId || !clientSecret) {
      return res.status(400).send('Both Client ID and Client Secret required.');
    }
    await patchState({ clientId, clientSecret });
    res.redirect('/login');
  });

  app.get('/login', async (req, res) => {
    res.type('html').send(await renderView('login.html'));
  });

  app.get('/auth/start', async (req, res) => {
    try {
      const state = generateState();
      oauthStates.add(state);
      const url = await buildAuthorizeUrl(state);
      res.redirect(url);
    } catch (err) {
      res.status(500).send(`Auth setup failed: ${err.message}`);
    }
  });

  app.get('/auth/callback', async (req, res) => {
    const { code, state, error } = req.query;
    if (error) return res.status(400).send(`Spotify returned error: ${error}`);
    if (!state || !oauthStates.has(state)) return res.status(400).send('Invalid OAuth state.');
    oauthStates.delete(state);
    if (!code) return res.status(400).send('Missing code.');
    try {
      await exchangeCodeForTokens(code);
      res.redirect('/dashboard');
    } catch (err) {
      res.status(500).send(`Token exchange failed: ${err.message}`);
    }
  });

  app.get('/dashboard', async (req, res) => {
    const state = await loadState();
    if (!state.clientId) return res.redirect('/setup');
    if (!state.refreshToken) return res.redirect('/login');

    let summary;
    try {
      const data = JSON.parse(await readFile(EXPORT_PATH, 'utf8'));
      const totalPlaylistTracks = (data.playlists ?? []).reduce((s, p) => s + (p.tracks?.length ?? 0), 0);
      const isrcHits = (data.thumbsUp ?? []).filter((t) => t.isrc).length;
      summary = {
        playlists: data.playlists?.length ?? 0,
        playlistTracks: totalPlaylistTracks,
        thumbsUp: data.thumbsUp?.length ?? 0,
        savedAlbums: data.savedAlbums?.length ?? 0,
        savedArtists: data.savedArtists?.length ?? 0,
        isrcCoverage: data.thumbsUp?.length ? `${((isrcHits / data.thumbsUp.length) * 100).toFixed(1)}%` : '0%',
      };
    } catch (err) {
      return res.status(500).send(`Couldn't read pandora-export.json: ${err.message}`);
    }

    res.type('html').send(await renderView('dashboard.html', {
      playlists: String(summary.playlists),
      playlistTracks: String(summary.playlistTracks),
      thumbsUp: String(summary.thumbsUp),
      savedAlbums: String(summary.savedAlbums),
      savedArtists: String(summary.savedArtists),
      isrcCoverage: summary.isrcCoverage,
    }));
  });

  app.get('/api/import/stream', (req, res) => {
    if (!activeImport) {
      res.status(404).json({ error: 'No active import.' });
      return;
    }
    attachSseStream(activeImport.bus, res);
  });

  app.post('/api/import/start', async (req, res) => {
    if (activeImport && !activeImport.done) {
      return res.status(409).json({ error: 'Import already running.' });
    }
    const bus = new ProgressBus();
    activeImport = { bus, done: false };
    res.json({ ok: true });

    runImport(bus)
      .then(() => {
        bus.send({ event: 'completed' });
        activeImport.done = true;
      })
      .catch((err) => {
        console.error('[import] failed:', err);
        bus.send({ event: 'error', message: err.message });
        activeImport.done = true;
      });
  });

  app.post('/api/logout', async (req, res) => {
    await patchState({ accessToken: null, refreshToken: null, expiresAt: null });
    res.redirect('/login');
  });

  return app;
}
