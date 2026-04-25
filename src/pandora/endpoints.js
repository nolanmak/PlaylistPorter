// Pandora internal API endpoints.
// Endpoints confirmed from two sources:
//   1. Live captures via /intercept against pandora.com (Apr 2026).
//   2. Pandora's web bundle (web-cdn.pandora.com/web-client-assets/web-app.*.js).
// All POSTs accept JSON, return JSON. Auth via cookie + X-CsrfToken + X-AuthToken headers.

export const BASE = 'https://www.pandora.com';

export const ENDPOINTS = {
  // Bootstrap / version check. Returns a bare numeric epoch like "1776643016182000".
  collectionsVersion: '/api/v5/collections/getVersion',

  // List the user's playlists (metadata only — track contents come from playlists/getTracks).
  // Response: { totalCount, annotations: { "PL:xxx:listenerId": { name, totalTracks, ... } }, items: [...] }
  sortedPlaylists: '/api/v6/collections/getSortedPlaylists',

  // Tracks inside a single playlist.
  // Body: { request: { pandoraId, limit, offset } }
  // Response: { tracks: [{ trackPandoraId, duration, addedTimestamp, ... }], totalTracks }
  playlistTracks: '/api/v7/playlists/getTracks',

  // Resolve pandora IDs (TR:xxx / AL:xxx / AR:xxx) to human metadata: title, artistName, ISRC, etc.
  // Body: { pandoraIds: [...] }
  // Response: keyed by id — { "TR:xxx": { name, artistName, albumName, durationMillis, isrc, ... } }
  annotateObjects: '/api/v4/catalog/annotateObjects',

  // Flat collection list (used by older Pandora UI).
  collectionItems: '/api/v6/collections/getItems',

  // Modern collection-by-type listing. Used for Albums tab + paginated saved tracks.
  // Body: { request: { sortOrder, offset, limit, annotationLimit, typePrefixes: ['ALL'|'TR'|'AL'] } }
  // Pagination: limit saturates at 1000 — caller paginates.
  sortedByTypes: '/api/v6/collections/getSortedByTypes',

  // Stations list.
  stations: '/api/v1/station/getStations',

  // GraphQL endpoint — richer queries (curators etc.).
  graphql: '/api/v1/graphql/graphql',
};

// Default request shapes (captured / inferred from web-app.js).
export const DEFAULTS = {
  sortedPlaylistsBody: {
    request: {
      sortOrder: 'MOST_RECENT_MODIFIED',
      limit: 1000,
      annotationLimit: 100,
    },
    isRecentModifiedPlaylists: false,
    allowedTypes: ['TR', 'AM'],
  },

  collectionItemsBody: {
    request: { limit: 1000 },
  },

  stationsBody: { pageSize: 250 },
};
