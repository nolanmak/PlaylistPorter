import { pandoraPost } from './client.js';
import { ENDPOINTS } from './endpoints.js';
import { annotateObjects, annotationToTrack } from './annotate.js';

const PAGE_SIZE = 1000;

// Pandora's "saved tracks" — paginated. The user may have >1000 saved tracks,
// so we loop getSortedByTypes with typePrefixes:['TR'] until exhausted, then
// resolve metadata in batches via annotateObjects.
export async function getSavedTracks() {
  const allItems = [];
  let offset = 0;
  while (true) {
    const data = await pandoraPost(ENDPOINTS.sortedByTypes, {
      request: {
        sortOrder: 'MOST_RECENT_ADDED',
        offset,
        limit: PAGE_SIZE,
        annotationLimit: 0,
        typePrefixes: ['TR'],
      },
    });
    const items = (data.items ?? []).filter((it) => it.pandoraType === 'TR');
    if (items.length === 0) break;
    allItems.push(...items);
    if (items.length < PAGE_SIZE) break;
    offset += items.length;
  }

  if (allItems.length === 0) return [];

  const ids = allItems.map((it) => it.pandoraId);
  const annotations = await annotateObjects(ids);
  return allItems.map((it) => ({
    ...annotationToTrack(it.pandoraId, annotations[it.pandoraId]),
    addedTime: it.addedTime ?? null,
  }));
}
