import { API_BASE_URL, AUTH_HEADERS } from '../config';

// Ratings only — one lookup per title viewed (PlayerScreen), not per card in
// a browse row, to stay well inside OMDb's free-tier request limit.
export async function fetchRatings(imdbId) {
  if (!imdbId) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/api/omdb/${imdbId}`, { headers: AUTH_HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.Response === 'False') return null;

    const rottenTomatoes = (data.Ratings || []).find((r) => r.Source === 'Rotten Tomatoes')?.Value || null;
    return {
      imdb: data.imdbRating && data.imdbRating !== 'N/A' ? data.imdbRating : null,
      rottenTomatoes,
      metascore: data.Metascore && data.Metascore !== 'N/A' ? data.Metascore : null,
    };
  } catch {
    return null;
  }
}
