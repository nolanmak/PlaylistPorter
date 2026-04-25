# PlaylistPorter

Export your Pandora library — playlists, saved tracks, saved albums and artists — to a portable JSON file. The output is shaped for a future Spotify importer (ISRC and UPC fields included so matching can be precise).

Pandora has no public API, so PlaylistPorter borrows the cookies and CSRF token from your authenticated browser session and replays the same internal endpoints the Pandora web client uses.

## Requirements

- Node.js **20+** (built-in `fetch`)
- macOS / Linux / Windows
- An active **Pandora** account (Premium recommended for playlists)
- The [Claude Intercept](https://github.com/anthropics/claude-code) MITM proxy at `~/claude_intercept` to capture cookies (or any other tool that lets you copy the `Cookie` header for `pandora.com`)

## Setup

```bash
git clone https://github.com/nolanmak/PlaylistPorter.git
cd PlaylistPorter
cp .env.example .env.local
```

### Capturing your Pandora session

1. Start the proxy and dashboard:
   ```bash
   node ~/claude_intercept/src/cli.js start
   ```
2. In the dashboard at `http://127.0.0.1:7778`, install + trust the CA cert and **Enable for This Mac**.
3. Open `pandora.com` in your browser, log in, and click around your library:
   - **My Collection → Playlists** — click *into* each playlist; scroll long ones to the bottom
   - **My Collection → Songs** — scroll to the bottom
   - **My Collection → Albums**
   - **My Collection → Artists**
4. Export the captured auth:
   ```bash
   node ~/claude_intercept/src/cli.js export --mode auth --host www.pandora.com
   ```
5. Open `.env.local` and fill in:
   - `PANDORA_COOKIE` — the **full** `cookie:` header value, copied verbatim from a captured request
   - `PANDORA_CSRF_TOKEN` — the value of the `csrftoken` cookie
   - `PANDORA_LISTENER_ID` — your numeric listener id (visible in playlist IDs as the suffix, e.g. `PL:xxx:THIS_NUMBER`)

The cookie includes a `_px3` PerimeterX token. **It expires.** If a run starts failing with 401/403, re-capture and update `.env.local`.

## Run

```bash
node src/index.js export
```

Writes `data/pandora-export.json`.

## Output shape

```jsonc
{
  "exportedAt": "2026-04-25T20:00:00.000Z",
  "listenerId": "462563063",
  "playlists": [
    {
      "id": "PL:207102912843743240:462563063",
      "name": "fire",
      "description": "",
      "totalTracks": 9,
      "tracks": [
        { "title": "...", "artist": "...", "album": "...", "durationMs": 0, "isrc": null }
      ]
    }
  ],
  "thumbsUp":     [ /* same track shape (saved/liked) */ ],
  "savedAlbums":  [ { "title": "...", "artist": "...", "year": 0, "upc": null } ],
  "savedArtists": [ { "name": "..." } ]
}
```

## Status

- ✅ Authenticated client (cookie + `X-CsrfToken` + `X-AuthToken` + UA)
- ✅ Playlist index (names, IDs, track counts)
- ✅ Per-playlist track listing — `/api/v7/playlists/getTracks`, paginated
- ✅ Saved tracks (paginated to handle >1000 saved)
- ✅ Saved albums — `/api/v6/collections/getSortedByTypes` with `typePrefixes:['AL']`
- ✅ Track / album metadata via `/api/v4/catalog/annotateObjects` (title, artist, album, durationMs, ISRC)
- ✅ Saved artists — derived from artistIds on saved albums + tracks, deduped, resolved

Real-account test: 12 playlists, 313 tracks across them, 1164 saved tracks (99.7% with ISRCs),
235 albums, 440 unique artists. End-to-end in ~5 seconds.

## Why JSON, not a direct Spotify import?

Two reasons:

1. **Idempotence + reproducibility.** Capture once, import anywhere — Spotify, Apple Music, YouTube Music. The dump is the source of truth.
2. **No Pandora<>Spotify auth coupling.** You can re-run the importer without ever touching Pandora again.

## Security

`.env.local` and `data/*.json` are gitignored. They contain session cookies and your full music library; do not commit them or share the JSON output.

## License

MIT
