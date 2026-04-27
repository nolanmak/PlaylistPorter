import { getAccessToken } from '../server/auth.js';

const BASE = 'https://api.spotify.com/v1';

export async function spotifyFetch(path, opts = {}) {
  let attempt = 0;
  let didRefresh = false;
  while (true) {
    attempt++;
    const token = await getAccessToken();
    const url = path.startsWith('http') ? path : `${BASE}${path}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    };
    const res = await fetch(url, { ...opts, headers });

    if (res.status === 401 && !didRefresh) {
      didRefresh = true;
      continue;
    }

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after') ?? '1');
      await sleep(Math.min(retryAfter, 30) * 1000);
      if (attempt < 5) continue;
    }

    if (res.status === 204) return null;

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Spotify ${res.status} on ${opts.method ?? 'GET'} ${path}: ${text.slice(0, 400)}`);
    }
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
