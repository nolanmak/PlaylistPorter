import { pandoraPost } from './client.js';
import { ENDPOINTS, DEFAULTS } from './endpoints.js';
import { annotateObjects, annotationToTrack } from './annotate.js';

export async function getPlaylistIndex() {
  const data = await pandoraPost(ENDPOINTS.sortedPlaylists, DEFAULTS.sortedPlaylistsBody);
  const annotations = data.annotations ?? {};
  const items = data.items ?? [];

  return items.map((item) => {
    const ann = annotations[item.pandoraId] ?? {};
    return {
      id: item.pandoraId,
      name: ann.name ?? 'Untitled',
      description: ann.description ?? '',
      totalTracks: ann.totalTracks ?? 0,
      timeCreated: ann.timeCreated ?? null,
      timeLastUpdated: ann.timeLastUpdated ?? null,
      isPrivate: ann.isPrivate ?? false,
      shareableUrlPath: ann.shareableUrlPath ?? null,
    };
  });
}

// Paginates through /api/v7/playlists/getTracks, then resolves each track to
// metadata via /api/v4/catalog/annotateObjects.
export async function getPlaylistTracks(playlistId) {
  const allRaw = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const data = await pandoraPost(ENDPOINTS.playlistTracks, {
      request: { pandoraId: playlistId, limit, offset },
    });
    const tracks = data.tracks ?? [];
    if (tracks.length === 0) break;
    allRaw.push(...tracks);
    const total = data.totalTracks ?? 0;
    offset += tracks.length;
    if (tracks.length < limit || offset >= total) break;
  }

  const trackIds = allRaw.map((t) => t.trackPandoraId ?? t.pandoraId).filter(Boolean);
  if (trackIds.length === 0) return [];

  const annotations = await annotateObjects(trackIds);
  return allRaw.map((raw) => {
    const id = raw.trackPandoraId ?? raw.pandoraId;
    return {
      ...annotationToTrack(id, annotations[id]),
      addedTimestamp: raw.addedTimestamp ?? null,
    };
  });
}
