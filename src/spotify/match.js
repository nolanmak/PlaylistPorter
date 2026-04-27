import { spotifyFetch } from './api.js';

const PAREN_NOISE = /\s*\((remaster(ed)?|deluxe( edition)?|expanded( edition)?|bonus track version|anniversary edition|live|mono|stereo|explicit|clean)[^)]*\)\s*/gi;

function normalize(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(PAREN_NOISE, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looseEqual(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.startsWith(nb) || nb.startsWith(na);
}

async function searchByIsrc(isrc) {
  const params = new URLSearchParams({ q: `isrc:${isrc}`, type: 'track', limit: '1' });
  const data = await spotifyFetch(`/search?${params.toString()}`);
  const items = data?.tracks?.items ?? [];
  return items[0] ?? null;
}

async function searchByTitleArtist(title, artist) {
  if (!title || !artist) return null;
  const q = `track:"${title.replace(/"/g, '')}" artist:"${artist.replace(/"/g, '')}"`;
  const params = new URLSearchParams({ q, type: 'track', limit: '5' });
  const data = await spotifyFetch(`/search?${params.toString()}`);
  const items = data?.tracks?.items ?? [];
  for (const item of items) {
    const itemArtist = item?.artists?.[0]?.name;
    if (looseEqual(item.name, title) && looseEqual(itemArtist, artist)) {
      return item;
    }
  }
  return null;
}

export async function resolveTrack({ pandoraId, title, artist, isrc }) {
  if (isrc) {
    const t = await searchByIsrc(isrc);
    if (t) return { spotifyUri: t.uri, spotifyId: t.id, source: 'isrc', track: t };
  }
  const t = await searchByTitleArtist(title, artist);
  if (t) return { spotifyUri: t.uri, spotifyId: t.id, source: 'fallback', track: t };
  return { spotifyUri: null, spotifyId: null, source: 'miss' };
}

async function searchAlbumByUpc(upc) {
  if (!upc) return null;
  const params = new URLSearchParams({ q: `upc:${upc}`, type: 'album', limit: '1' });
  const data = await spotifyFetch(`/search?${params.toString()}`);
  return data?.albums?.items?.[0] ?? null;
}

async function searchAlbumByTitleArtist(title, artist) {
  if (!title || !artist) return null;
  const q = `album:"${title.replace(/"/g, '')}" artist:"${artist.replace(/"/g, '')}"`;
  const params = new URLSearchParams({ q, type: 'album', limit: '5' });
  const data = await spotifyFetch(`/search?${params.toString()}`);
  const items = data?.albums?.items ?? [];
  for (const item of items) {
    const itemArtist = item?.artists?.[0]?.name;
    if (looseEqual(item.name, title) && looseEqual(itemArtist, artist)) {
      return item;
    }
  }
  return null;
}

export async function resolveAlbum({ title, artist, upc }) {
  if (upc) {
    const a = await searchAlbumByUpc(upc);
    if (a) return { spotifyUri: a.uri, spotifyId: a.id, source: 'upc' };
  }
  const a = await searchAlbumByTitleArtist(title, artist);
  if (a) return { spotifyUri: a.uri, spotifyId: a.id, source: 'fallback' };
  return { spotifyUri: null, spotifyId: null, source: 'miss' };
}

export async function resolveArtist({ name }) {
  if (!name) return { spotifyId: null, source: 'miss' };
  const params = new URLSearchParams({ q: `artist:"${name.replace(/"/g, '')}"`, type: 'artist', limit: '5' });
  const data = await spotifyFetch(`/search?${params.toString()}`);
  const items = data?.artists?.items ?? [];
  for (const item of items) {
    if (looseEqual(item.name, name)) {
      return { spotifyId: item.id, spotifyUri: item.uri, source: 'name' };
    }
  }
  // Fall back to the top result if any — Spotify search ranks by popularity
  if (items[0]) return { spotifyId: items[0].id, spotifyUri: items[0].uri, source: 'fallback' };
  return { spotifyId: null, source: 'miss' };
}
