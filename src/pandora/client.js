import { BASE } from './endpoints.js';

function loadEnv() {
  const cookie = process.env.PANDORA_COOKIE?.trim();
  const csrf = process.env.PANDORA_CSRF_TOKEN?.trim();
  const ua = process.env.PANDORA_USER_AGENT?.trim() ||
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36';

  if (!cookie) throw new Error('PANDORA_COOKIE is empty. Run /intercept and paste the full Cookie header into .env.local.');
  if (!csrf) throw new Error('PANDORA_CSRF_TOKEN is empty. Set it to the value of the `csrftoken` cookie.');

  return { cookie, csrf, ua };
}

export async function pandoraPost(path, body = {}) {
  const { cookie, csrf, ua } = loadEnv();
  const url = `${BASE}${path}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'accept': 'application/json, text/plain, */*',
      'content-type': 'application/json',
      'origin': BASE,
      'referer': `${BASE}/`,
      'user-agent': ua,
      'x-csrftoken': csrf,
      'cookie': cookie,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Pandora ${res.status} on ${path} — auth expired. Re-capture cookies via /intercept and update .env.local.`);
  }
  if (!res.ok) {
    throw new Error(`Pandora ${res.status} on ${path}: ${text.slice(0, 500)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    // Some endpoints (e.g. getVersion) return a bare numeric body.
    return text;
  }
}
