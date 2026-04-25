// Pandora internal API endpoints.
// Discovered via /intercept against pandora.com web client (April 2026).
// All POSTs accept JSON, return JSON. Auth via Cookie header + X-CsrfToken header.

export const BASE = 'https://www.pandora.com';

export const ENDPOINTS = {
  // Bootstrap / version check. Returns a numeric epoch like "1776643016182000".
  collectionsVersion: '/api/v5/collections/getVersion',

  // List the user's playlists (metadata only — track contents come from a separate call).
  // Body: { request: { sortOrder: "MOST_RECENT_MODIFIED", limit, annotationLimit }, isRecentModifiedPlaylists: false, allowedTypes: ["TR","AM"] }
  // Response: { totalCount, annotations: { "PL:xxx:listenerId": { name, totalTracks, ... } }, items: [{ pandoraId, ... }] }
  sortedPlaylists: '/api/v6/collections/getSortedPlaylists',

  // List items in the user's collection (saved tracks; albums/artists may use the same endpoint
  // with different `allowedTypes`). Body: { request: { limit } }.
  // Response: { items: [{ pandoraId: "TR:xxx", albumPandoraId: "AL:xxx", addedTime }] } — IDs only.
  collectionItems: '/api/v6/collections/getItems',

  // Stations list.
  // Body: { pageSize: 250 }.
  stations: '/api/v1/station/getStations',

  // GraphQL endpoint — used by the web client for richer queries (curators, playlist tracks, etc.).
  // Body: { query, operationName, variables }
  graphql: '/api/v1/graphql/graphql',
};

// Default request shapes captured from real traffic.
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
