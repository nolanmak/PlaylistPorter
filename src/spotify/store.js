import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const STATE_PATH = resolve(ROOT, 'data/spotify-state.json');
const MATCH_CACHE_PATH = resolve(ROOT, 'data/match-cache.json');
const MISSES_PATH = resolve(ROOT, 'data/import-misses.csv');

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJsonAtomic(path, data) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2));
  await rename(tmp, path);
}

export async function loadState() {
  return readJson(STATE_PATH, {});
}

export async function saveState(state) {
  await writeJsonAtomic(STATE_PATH, state);
}

export async function patchState(patch) {
  const current = await loadState();
  const next = { ...current, ...patch };
  await saveState(next);
  return next;
}

export async function loadMatchCache() {
  return readJson(MATCH_CACHE_PATH, {});
}

export async function saveMatchCache(cache) {
  await writeJsonAtomic(MATCH_CACHE_PATH, cache);
}

export async function appendMiss(row) {
  await mkdir(dirname(MISSES_PATH), { recursive: true });
  const csv = [row.kind, row.pandoraId, csvEscape(row.title), csvEscape(row.artist), row.isrc ?? ''].join(',') + '\n';
  const { appendFile, stat } = await import('node:fs/promises');
  try {
    await stat(MISSES_PATH);
  } catch {
    await writeFile(MISSES_PATH, 'kind,pandoraId,title,artist,isrc\n');
  }
  await appendFile(MISSES_PATH, csv);
}

function csvEscape(s) {
  if (s == null) return '';
  const str = String(s);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export const PATHS = { STATE_PATH, MATCH_CACHE_PATH, MISSES_PATH, ROOT };
