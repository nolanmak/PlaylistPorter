#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getPlaylistIndex, getPlaylistTracks } from './pandora/playlists.js';
import { getSavedTracks } from './pandora/thumbs.js';
import { getSavedAlbums, getSavedArtists } from './pandora/collection.js';
import { writeJsonAtomic } from './util/writeJson.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

async function loadDotEnvLocal() {
  const path = resolve(ROOT, '.env.local');
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function runExport() {
  console.log('→ fetching playlist index…');
  const playlists = await getPlaylistIndex();
  console.log(`  ${playlists.length} playlists`);

  console.log('→ fetching tracks for each playlist…');
  const playlistsWithTracks = [];
  for (const pl of playlists) {
    try {
      const tracks = await getPlaylistTracks(pl.id);
      playlistsWithTracks.push({ ...pl, tracks });
      console.log(`  ${pl.name}: ${tracks.length} tracks`);
    } catch (err) {
      console.warn(`  ${pl.name}: SKIPPED (${err.message})`);
      playlistsWithTracks.push({ ...pl, tracks: [] });
    }
  }

  console.log('→ fetching saved tracks (thumbs / library)…');
  const thumbsUp = await getSavedTracks();
  console.log(`  ${thumbsUp.length} saved tracks`);

  console.log('→ fetching saved albums…');
  let savedAlbums = [];
  try {
    savedAlbums = await getSavedAlbums();
    console.log(`  ${savedAlbums.length} albums`);
  } catch (err) {
    console.warn(`  albums skipped: ${err.message}`);
  }

  console.log('→ fetching saved artists…');
  let savedArtists = [];
  try {
    savedArtists = await getSavedArtists();
    console.log(`  ${savedArtists.length} artists`);
  } catch (err) {
    console.warn(`  artists skipped: ${err.message}`);
  }

  const out = {
    exportedAt: new Date().toISOString(),
    listenerId: process.env.PANDORA_LISTENER_ID || null,
    playlists: playlistsWithTracks,
    thumbsUp,
    savedAlbums,
    savedArtists,
  };

  const outPath = resolve(ROOT, 'data/pandora-export.json');
  await writeJsonAtomic(outPath, out);
  console.log(`\nWrote ${outPath}`);
}

async function main() {
  await loadDotEnvLocal();
  const cmd = process.argv[2] ?? 'export';
  if (cmd === 'export') return runExport();
  console.error(`Unknown command: ${cmd}\nUsage: playlist-porter export`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
