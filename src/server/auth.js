import crypto from 'node:crypto';
import { loadState, patchState } from '../spotify/store.js';

export const REDIRECT_URI = 'http://127.0.0.1:8888/auth/callback';

const SCOPES = [
  'playlist-modify-private',
  'playlist-modify-public',
  'user-library-modify',
  'user-library-read',
  'user-follow-modify',
  'user-follow-read',
  'user-read-private',
].join(' ');

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';

export function generateState() {
  return crypto.randomBytes(32).toString('hex');
}

export async function buildAuthorizeUrl(state) {
  const { clientId } = await loadState();
  if (!clientId) throw new Error('Spotify clientId not set yet — finish setup first.');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state,
    show_dialog: 'true',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code) {
  const { clientId, clientSecret } = await loadState();
  if (!clientId || !clientSecret) throw new Error('Missing Spotify clientId/clientSecret');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Spotify token exchange ${res.status}: ${text}`);
  const data = JSON.parse(text);

  await patchState({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  });

  return data;
}

async function refreshAccessToken() {
  const { clientId, clientSecret, refreshToken } = await loadState();
  if (!refreshToken) throw new Error('No refresh token — login first.');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Spotify refresh ${res.status}: ${text}`);
  const data = JSON.parse(text);

  const next = await patchState({
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
  });

  return next.accessToken;
}

export async function getAccessToken() {
  const state = await loadState();
  if (!state.accessToken || !state.expiresAt) {
    return refreshAccessToken();
  }
  if (Date.now() >= state.expiresAt - 60_000) {
    return refreshAccessToken();
  }
  return state.accessToken;
}
