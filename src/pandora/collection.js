import { pandoraPost } from './client.js';
import { ENDPOINTS } from './endpoints.js';
import { annotateObjects, annotationToAlbum, annotationToArtist } from './annotate.js';

const PAGE_SIZE = 1000;

async function getAllByPrefix(typePrefix) {
  const all = [];
  let offset = 0;
  while (true) {
    const data = await pandoraPost(ENDPOINTS.sortedByTypes, {
      request: {
        sortOrder: 'MOST_RECENT_ADDED',
        offset,
        limit: PAGE_SIZE,
        annotationLimit: 0,
        typePrefixes: [typePrefix],
      },
    });
    const items = data.items ?? [];
    if (items.length === 0) break;
    all.push(...items);
    if (items.length < PAGE_SIZE) break;
    offset += items.length;
  }
  return all;
}

export async function getSavedAlbums() {
  const items = await getAllByPrefix('AL');
  if (items.length === 0) return [];
  const ids = items.map((i) => i.pandoraId);
  const annotations = await annotateObjects(ids);
  return items.map((it) => ({
    ...annotationToAlbum(it.pandoraId, annotations[it.pandoraId]),
    addedTime: it.addedTime ?? null,
  }));
}

// Pandora's modern UI doesn't expose a "saved artists" list — getSortedByTypes
// returns 0 for AR. Derive saved artists from the artistPandoraIds attached to
// saved albums + saved tracks, dedupe, resolve names.
export async function deriveSavedArtists(savedAlbums, savedTracks) {
  const artistIds = new Set();
  for (const a of savedAlbums) if (a.artistPandoraId) artistIds.add(a.artistPandoraId);
  for (const t of savedTracks) if (t.artistPandoraId) artistIds.add(t.artistPandoraId);
  if (artistIds.size === 0) return [];
  const annotations = await annotateObjects([...artistIds]);
  return [...artistIds].map((id) => annotationToArtist(id, annotations[id]));
}
