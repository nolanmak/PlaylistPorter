import { pandoraPost } from './client.js';
import { ENDPOINTS, DEFAULTS } from './endpoints.js';

// Pandora's modern Premium model treats "saved tracks" as the user's library.
// /api/v6/collections/getItems returns saved track IDs (TR:xxx) and their albums.
// Track titles/artists need to be resolved via a separate annotate call (TODO).
export async function getSavedTracks() {
  const data = await pandoraPost(ENDPOINTS.collectionItems, DEFAULTS.collectionItemsBody);
  const items = data.items ?? [];

  return items
    .filter((it) => it.pandoraType === 'TR')
    .map((it) => ({
      pandoraId: it.pandoraId,
      albumPandoraId: it.albumPandoraId ?? null,
      addedTime: it.addedTime ?? null,
      // title/artist/album fields come from a future annotate-objects call.
      title: null,
      artist: null,
      album: null,
      durationMs: null,
      isrc: null,
    }));
}
