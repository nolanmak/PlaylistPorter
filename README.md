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

**Pandora export** ✅
- Authenticated client (cookie + `X-CsrfToken` + `X-AuthToken` + UA)
- Playlist index, per-playlist tracks, saved tracks, saved albums
- Track metadata via `/api/v4/catalog/annotateObjects` (title, artist, album, durationMs, ISRC)
- Saved artists derived from artistIds on saved albums + tracks
- Real-account test: 12 playlists, 313 playlist tracks, 1164 saved (99.7% ISRC coverage), 235 albums, 440 artists in ~5 seconds

**Spotify upload** ✅
- Local browser-based dashboard (`node src/index.js serve`)
- Authorization Code OAuth flow with auto-refresh
- ISRC-first matching with title+artist fallback
- Idempotent — re-running is a fast no-op (matches existing playlists by `[PlaylistPorter:<id>]` description tag)
- Live SSE progress UI

## Importing to Spotify

```bash
cd ~/PlaylistPorter
node src/index.js serve   # opens http://127.0.0.1:8888 in your browser
```

First run walks you through:

1. Registering a free [Spotify Developer App](https://developer.spotify.com/dashboard) (~5 min, no cost)
   - Redirect URI: `http://127.0.0.1:8888/auth/callback` (the form shows this verbatim, copy/paste)
2. Pasting Client ID + Client Secret into the dashboard form
3. Click **Sign in with Spotify** → approve → you're on the import dashboard
4. Click **Start Import** — live progress streams via SSE

The importer saves: thumbed tracks → Library, albums → Library, artists → Followed, playlists → Playlists. Anything it can't resolve goes to `data/import-misses.csv` for manual review.

## Why JSON-first?

The two-stage design (Pandora → JSON → Spotify) means:

1. **Idempotence + reproducibility.** Capture once, import anywhere — Spotify, Apple Music, YouTube Music. The dump is the source of truth.
2. **No Pandora<>Spotify auth coupling.** You can re-run the importer without ever touching Pandora again.

## Security

`.env.local` and `data/*.json` are gitignored. They contain session cookies and your full music library; do not commit them or share the JSON output.

## License

MIT
