/* Browser-side TMDB client. Proxies through the server when TMDB_API_KEY is
   configured there; otherwise falls back to a key entered in the settings
   dialog (saved to localStorage) — lets this app run with no backend at all. */

const API = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/w780';
const PROFILE_BASE = 'https://image.tmdb.org/t/p/w185';

let serverConfigured = null;

export async function isTmdbServerConfigured() {
  if (serverConfigured !== null) return serverConfigured;
  try {
    const res = await fetch('/api/config');
    const data = res.ok ? await res.json() : { tmdbConfigured: false };
    serverConfigured = Boolean(data.tmdbConfigured);
  } catch {
    serverConfigured = false;
  }
  return serverConfigured;
}

export function getApiKey() {
  return localStorage.getItem('tmdb_key') || '';
}

export function setApiKey(key) {
  localStorage.setItem('tmdb_key', key.trim());
}

function authedUrl(path, params = {}) {
  const key = getApiKey();
  const url = new URL(API + path);
  url.searchParams.set('language', 'en-US');
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }
  // v4 read tokens are long JWTs (three dot-separated segments); everything
  // else is treated as a v3 api_key query param.
  if (key.split('.').length === 3 && key.length > 100) {
    return { url, headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' } };
  }
  url.searchParams.set('api_key', key);
  return { url, headers: { Accept: 'application/json' } };
}

async function get(path, params) {
  if (await isTmdbServerConfigured()) {
    const url = new URL('/api/tmdb' + path, window.location.origin);
    for (const [k, v] of Object.entries(params || {})) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('TMDB request failed: ' + res.status + ' ' + res.statusText);
    return res.json();
  }

  if (!getApiKey()) throw new Error('No TMDB API key set. Click "API Key" to add one.');
  const { url, headers } = authedUrl(path, params);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('TMDB request failed: ' + res.status + ' ' + res.statusText);
  return res.json();
}

export function posterUrl(path) {
  return path ? IMAGE_BASE + path : null;
}

export function backdropUrl(path) {
  return path ? BACKDROP_BASE + path : null;
}

export function profileUrl(path) {
  return path ? PROFILE_BASE + path : null;
}

function mapResult(r, forcedType) {
  const type = forcedType || r.media_type;
  if (type === 'person') {
    return { id: r.id, type: 'person', title: r.name, poster: profileUrl(r.profile_path), popularity: r.popularity || 0 };
  }
  return {
    id: r.id,
    type,
    title: r.title || r.name,
    year: (r.release_date || r.first_air_date || '').slice(0, 4),
    poster: posterUrl(r.poster_path),
    backdrop: backdropUrl(r.backdrop_path),
    overview: r.overview,
    popularity: r.popularity || 0,
  };
}

export async function searchMulti(query) {
  const data = await get('/search/multi', { query, include_adult: 'false' });
  return (data.results || [])
    .filter((r) => r.media_type === 'movie' || r.media_type === 'tv' || r.media_type === 'person')
    .map((r) => mapResult(r))
    .sort((a, b) => b.popularity - a.popularity);
}

export async function fetchTrending() {
  const data = await get('/trending/all/week', {});
  // /trending has no language filter param, unlike /discover — filter client-side.
  return (data.results || [])
    .filter((r) => (r.media_type === 'movie' || r.media_type === 'tv') && r.original_language === 'en')
    .map((r) => mapResult(r));
}

export async function fetchPopular(type) {
  const kind = type === 'tv' ? 'tv' : 'movie';
  // /discover (unlike /{type}/popular) supports filtering server-side.
  const data = await get(`/discover/${kind}`, { with_original_language: 'en', sort_by: 'popularity.desc' });
  return (data.results || []).map((r) => mapResult(r, kind));
}

export async function fetchDetails(type, id) {
  const kind = type === 'tv' ? 'tv' : 'movie';
  return get('/' + kind + '/' + id, { append_to_response: 'external_ids,videos,credits' });
}

export async function fetchSeason(tvId, seasonNumber) {
  return get(`/tv/${tvId}/season/${seasonNumber}`);
}

// Neither /similar nor /recommendations take a language or sort param —
// filter/sort client-side. Require a minimum vote count so a handful of
// 10/10 votes can't outrank something genuinely well-reviewed.
function filterAndRankResults(results, kind) {
  return (results || [])
    .filter((r) => r.original_language === 'en' && r.vote_count >= 20)
    .sort((a, b) => b.vote_average - a.vote_average)
    .map((r) => mapResult(r, kind));
}

export async function fetchSimilar(type, id) {
  const kind = type === 'tv' ? 'tv' : 'movie';
  const data = await get(`/${kind}/${id}/similar`, {});
  return filterAndRankResults(data.results, kind);
}

export async function fetchRecommendations(type, id) {
  const kind = type === 'tv' ? 'tv' : 'movie';
  const data = await get(`/${kind}/${id}/recommendations`, {});
  return filterAndRankResults(data.results, kind);
}

export async function fetchPerson(personId) {
  return get(`/person/${personId}`, {});
}

export async function fetchPersonCredits(personId) {
  const data = await get(`/person/${personId}/combined_credits`, {});
  return (data.cast || [])
    .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
    .map((r) => mapResult(r))
    .sort((a, b) => b.popularity - a.popularity);
}
