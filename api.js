/* Client for this project's own backend (server.js): Continue Watching and
   Favorites, both persisted in Postgres. See schema.sql for the tables. */

const API = '/api';

async function request(path, options) {
  const res = await fetch(API + path, options);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

export function getContinueWatching() {
  return request('/continue-watching');
}

export function getContinueWatchingItem(mediaType, tmdbId) {
  return request(`/continue-watching/${mediaType}/${tmdbId}`);
}

export function saveProgress(entry) {
  return request('/continue-watching', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
}

export function removeContinueWatching(mediaType, tmdbId) {
  return request(`/continue-watching/${mediaType}/${tmdbId}`, { method: 'DELETE' });
}

export function getFavorites() {
  return request('/favorites');
}

export function getFavorite(mediaType, tmdbId) {
  return request(`/favorites/${mediaType}/${tmdbId}`);
}

export function addFavorite(entry) {
  return request('/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
}

export function removeFavorite(mediaType, tmdbId) {
  return request(`/favorites/${mediaType}/${tmdbId}`, { method: 'DELETE' });
}
