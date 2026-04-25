import { pandoraPost } from './client.js';
import { ENDPOINTS, DEFAULTS } from './endpoints.js';

export async function getPlaylistIndex() {
  const data = await pandoraPost(ENDPOINTS.sortedPlaylists, DEFAULTS.sortedPlaylistsBody);
  const annotations = data.annotations ?? {};
  const items = data.items ?? [];

  return items.map((item) => {
    const ann = annotations[item.pandoraId] ?? {};
    return {
      id: item.pandoraId,
      name: ann.name ?? item.name ?? 'Untitled',
      description: ann.description ?? '',
      totalTracks: ann.totalTracks ?? 0,
      timeCreated: ann.timeCreated ?? null,
      timeLastUpdated: ann.timeLastUpdated ?? null,
      isPrivate: ann.isPrivate ?? false,
      shareableUrlPath: ann.shareableUrlPath ?? null,
      raw: ann,
    };
  });
}

// TODO: implement once /intercept captures the per-playlist tracks call
// (likely a graphql query or /api/vN/playlists/getTracks). For each playlist id,
// returns [{ title, artist, album, durationMs, isrc?, pandoraIds: { trackId, albumId } }].
export async function getPlaylistTracks(_playlistId) {
  throw new Error('getPlaylistTracks not yet implemented — needs a fresh /intercept capture of clicking into a playlist.');
}
