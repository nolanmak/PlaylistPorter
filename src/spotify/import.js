import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { spotifyFetch } from './api.js';
import { resolveTrack, resolveAlbum, resolveArtist } from './match.js';
import { loadMatchCache, saveMatchCache, appendMiss } from './store.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const EXPORT_PATH = resolve(ROOT, 'data/pandora-export.json');

const PLAYLIST_DESC_TAG = (pandoraId) => `[PlaylistPorter:${pandoraId}]`;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function getMyId() {
  const me = await spotifyFetch('/me');
  return me.id;
}

async function getMyPlaylists() {
  const all = [];
  let url = '/me/playlists?limit=50';
  while (url) {
    const page = await spotifyFetch(url);
    all.push(...(page.items ?? []));
    url = page.next ? page.next.replace('https://api.spotify.com/v1', '') : null;
  }
  return all;
}

async function getPlaylistTrackUris(playlistId) {
  const out = new Set();
  let url = `/playlists/${playlistId}/tracks?fields=items(track(uri)),next&limit=100`;
  while (url) {
    const page = await spotifyFetch(url);
    for (const it of page.items ?? []) {
      if (it?.track?.uri) out.add(it.track.uri);
    }
    url = page.next ? page.next.replace('https://api.spotify.com/v1', '') : null;
  }
  return out;
}

async function checkContains(path, ids) {
  if (ids.length === 0) return [];
  const result = [];
  for (const batch of chunk(ids, 50)) {
    const params = new URLSearchParams({ ids: batch.join(',') });
    const flags = await spotifyFetch(`${path}?${params.toString()}`);
    for (let i = 0; i < batch.length; i++) {
      result.push({ id: batch[i], saved: flags[i] });
    }
  }
  return result;
}

export async function runImport(progress) {
  const emit = (event, data = {}) => progress?.send?.({ event, ...data });

  emit('phase', { name: 'load', label: 'Loading export…' });
  const exportData = JSON.parse(await readFile(EXPORT_PATH, 'utf8'));
  const matchCache = await loadMatchCache();

  // 1. Collect every unique pandora track ID we need to resolve.
  const uniqueTrackIds = new Map(); // pandoraId -> { pandoraId, title, artist, isrc }
  const addTrack = (t, kind) => {
    if (!t?.pandoraId) return;
    if (!uniqueTrackIds.has(t.pandoraId)) {
      uniqueTrackIds.set(t.pandoraId, {
        pandoraId: t.pandoraId,
        title: t.title,
        artist: t.artist,
        isrc: t.isrc ?? null,
        kind,
      });
    }
  };
  for (const t of exportData.thumbsUp ?? []) addTrack(t, 'thumb');
  for (const pl of exportData.playlists ?? []) {
    for (const t of pl.tracks ?? []) addTrack(t, 'playlist');
  }

  const totalTracks = uniqueTrackIds.size;
  emit('phase', { name: 'resolve', label: 'Resolving tracks via Spotify search', total: totalTracks });

  let done = 0;
  let isrcHits = 0;
  let fallbackHits = 0;
  let misses = 0;

  for (const meta of uniqueTrackIds.values()) {
    done++;
    if (matchCache[meta.pandoraId] !== undefined) {
      const cached = matchCache[meta.pandoraId];
      if (cached) {
        if (cached.source === 'isrc') isrcHits++;
        else fallbackHits++;
      } else {
        misses++;
      }
      if (done % 25 === 0 || done === totalTracks) emit('progress', { done, total: totalTracks });
      continue;
    }
    try {
      const r = await resolveTrack(meta);
      matchCache[meta.pandoraId] = r.spotifyUri ? { uri: r.spotifyUri, id: r.spotifyId, source: r.source } : null;
      if (r.spotifyUri) {
        if (r.source === 'isrc') isrcHits++;
        else fallbackHits++;
      } else {
        misses++;
        await appendMiss({ kind: 'track', ...meta });
      }
    } catch (err) {
      misses++;
      emit('warn', { message: `resolve ${meta.pandoraId} (${meta.title}): ${err.message}` });
    }
    if (done % 25 === 0 || done === totalTracks) {
      emit('progress', { done, total: totalTracks, isrcHits, fallbackHits, misses });
      await saveMatchCache(matchCache);
    }
  }
  await saveMatchCache(matchCache);
  emit('phase', { name: 'resolve-done', isrcHits, fallbackHits, misses, total: totalTracks });

  const uriOf = (pandoraId) => matchCache[pandoraId]?.uri ?? null;
  const idOf = (pandoraId) => matchCache[pandoraId]?.id ?? null;

  // 2. Save library tracks (thumbs)
  emit('phase', { name: 'save-tracks', label: 'Saving library tracks' });
  const thumbIds = (exportData.thumbsUp ?? [])
    .map((t) => idOf(t.pandoraId))
    .filter(Boolean);
  if (thumbIds.length > 0) {
    const checks = await checkContains('/me/tracks/contains', thumbIds);
    const toSave = checks.filter((c) => !c.saved).map((c) => c.id);
    emit('progress', { done: 0, total: toSave.length, label: `${toSave.length}/${thumbIds.length} new` });
    let saved = 0;
    for (const batch of chunk(toSave, 50)) {
      await spotifyFetch('/me/tracks', { method: 'PUT', body: JSON.stringify({ ids: batch }) });
      saved += batch.length;
      emit('progress', { done: saved, total: toSave.length });
    }
    emit('phase', { name: 'save-tracks-done', saved, alreadySaved: thumbIds.length - toSave.length });
  } else {
    emit('phase', { name: 'save-tracks-done', saved: 0, alreadySaved: 0 });
  }

  // 3. Save albums
  emit('phase', { name: 'save-albums', label: 'Saving albums' });
  const albumResults = [];
  for (const a of exportData.savedAlbums ?? []) {
    const r = await resolveAlbum(a);
    if (r.spotifyId) albumResults.push(r.spotifyId);
    else await appendMiss({ kind: 'album', pandoraId: a.pandoraId, title: a.title, artist: a.artist, isrc: '' });
  }
  if (albumResults.length > 0) {
    const checks = await checkContains('/me/albums/contains', albumResults);
    const toSave = checks.filter((c) => !c.saved).map((c) => c.id);
    let saved = 0;
    for (const batch of chunk(toSave, 50)) {
      await spotifyFetch('/me/albums', { method: 'PUT', body: JSON.stringify({ ids: batch }) });
      saved += batch.length;
      emit('progress', { done: saved, total: toSave.length });
    }
    emit('phase', { name: 'save-albums-done', resolved: albumResults.length, saved, total: (exportData.savedAlbums ?? []).length });
  } else {
    emit('phase', { name: 'save-albums-done', resolved: 0, saved: 0, total: (exportData.savedAlbums ?? []).length });
  }

  // 4. Follow artists
  emit('phase', { name: 'follow-artists', label: 'Following artists' });
  const artistIds = [];
  for (const a of exportData.savedArtists ?? []) {
    const r = await resolveArtist({ name: a.name });
    if (r.spotifyId) artistIds.push(r.spotifyId);
    else await appendMiss({ kind: 'artist', pandoraId: a.pandoraId ?? '', title: a.name ?? '', artist: '', isrc: '' });
  }
  if (artistIds.length > 0) {
    const checks = await checkContains('/me/following/contains?type=artist', artistIds);
    const toFollow = checks.filter((c) => !c.saved).map((c) => c.id);
    for (const batch of chunk(toFollow, 50)) {
      const params = new URLSearchParams({ type: 'artist', ids: batch.join(',') });
      await spotifyFetch(`/me/following?${params.toString()}`, { method: 'PUT' });
    }
    emit('phase', { name: 'follow-artists-done', resolved: artistIds.length, followed: toFollow.length, total: (exportData.savedArtists ?? []).length });
  } else {
    emit('phase', { name: 'follow-artists-done', resolved: 0, followed: 0, total: (exportData.savedArtists ?? []).length });
  }

  // 5+6. Create playlists + add tracks
  emit('phase', { name: 'playlists', label: 'Creating playlists + adding tracks' });
  const myId = await getMyId();
  const myPlaylists = await getMyPlaylists();
  const playlistsByMarker = new Map();
  for (const pl of myPlaylists) {
    if (!pl?.description) continue;
    const m = pl.description.match(/\[PlaylistPorter:([^\]]+)\]/);
    if (m) playlistsByMarker.set(m[1], pl);
  }

  let pNum = 0;
  for (const pl of exportData.playlists ?? []) {
    pNum++;
    let target = playlistsByMarker.get(pl.id);
    if (!target) {
      const description = `Imported from Pandora · ${PLAYLIST_DESC_TAG(pl.id)}`;
      target = await spotifyFetch(`/users/${myId}/playlists`, {
        method: 'POST',
        body: JSON.stringify({ name: pl.name, description, public: false }),
      });
    }
    const existing = await getPlaylistTrackUris(target.id);
    const wantUris = pl.tracks.map((t) => uriOf(t.pandoraId)).filter((u) => u && !existing.has(u));
    let added = 0;
    for (const batch of chunk(wantUris, 100)) {
      await spotifyFetch(`/playlists/${target.id}/tracks`, {
        method: 'POST',
        body: JSON.stringify({ uris: batch }),
      });
      added += batch.length;
    }
    emit('playlist', { name: pl.name, added, total: pl.tracks.length, missing: pl.tracks.length - existing.size - added, n: pNum });
  }
  emit('phase', { name: 'playlists-done' });

  emit('done', { totalTracks, isrcHits, fallbackHits, misses });
}
