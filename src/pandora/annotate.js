import { pandoraPost } from './client.js';
import { ENDPOINTS } from './endpoints.js';

// Resolve a list of pandora IDs (TR:xxx, AL:xxx, AR:xxx) to human metadata.
// Pandora chunks ~100 ids/call comfortably; we batch to be safe.
export async function annotateObjects(ids) {
  const out = {};
  const batchSize = 100;
  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    const data = await pandoraPost(ENDPOINTS.annotateObjects, { pandoraIds: chunk });
    Object.assign(out, data ?? {});
  }
  return out;
}

export function annotationToTrack(id, ann) {
  if (!ann) return { pandoraId: id, title: null, artist: null, artistPandoraId: null, album: null, albumPandoraId: null, durationMs: null, isrc: null };
  return {
    pandoraId: id,
    title: ann.name ?? null,
    artist: ann.artistName ?? null,
    artistPandoraId: ann.artistId ?? null,
    album: ann.albumName ?? null,
    albumPandoraId: ann.albumId ?? null,
    durationMs: ann.durationMillis ?? (ann.duration ? ann.duration * 1000 : null),
    isrc: ann.isrc ?? null,
  };
}

export function annotationToAlbum(id, ann) {
  if (!ann) return { pandoraId: id, title: null, artist: null, artistPandoraId: null, year: null, upc: null, trackCount: null };
  return {
    pandoraId: id,
    title: ann.name ?? null,
    artist: ann.artistName ?? null,
    artistPandoraId: ann.artistId ?? null,
    year: ann.releaseDate ? Number(String(ann.releaseDate).slice(0, 4)) : null,
    upc: ann.upc ?? null,
    trackCount: ann.trackCount ?? null,
  };
}

export function annotationToArtist(id, ann) {
  if (!ann) return { pandoraId: id, name: null };
  return {
    pandoraId: id,
    name: ann.name ?? null,
  };
}
