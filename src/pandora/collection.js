import { pandoraPost } from './client.js';
import { ENDPOINTS } from './endpoints.js';

// TODO: confirm shape after the user browses the Albums tab — likely a getItems call
// with allowedTypes including AL, or a dedicated endpoint surfaced by intercept.
export async function getSavedAlbums() {
  const data = await pandoraPost(ENDPOINTS.collectionItems, {
    request: { limit: 1000 },
    allowedTypes: ['AL'],
  });
  const items = (data.items ?? []).filter((it) => it.pandoraType === 'AL');
  return items.map((it) => ({
    pandoraId: it.pandoraId,
    addedTime: it.addedTime ?? null,
    title: null,
    artist: null,
    year: null,
    upc: null,
  }));
}

// TODO: confirm shape after the user browses the Artists tab.
export async function getSavedArtists() {
  const data = await pandoraPost(ENDPOINTS.collectionItems, {
    request: { limit: 1000 },
    allowedTypes: ['AR'],
  });
  const items = (data.items ?? []).filter((it) => it.pandoraType === 'AR');
  return items.map((it) => ({
    pandoraId: it.pandoraId,
    addedTime: it.addedTime ?? null,
    name: null,
  }));
}
