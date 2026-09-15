import { getApiKey, setApiKey, isTmdbServerConfigured, posterUrl, fetchTrending, fetchPopular, fetchRecommendations, fetchDetails } from './tmdb.js';
import { getContinueWatching, removeContinueWatching, getFavorites, removeFavorite } from './api.js';
import { renderMediaRow, renderHero } from './ui.js';
import { openSeasonEpisodePicker } from './seasonEpisodePicker.js';

const heroEl = document.getElementById('hero');

const rows = {
  continue: { section: document.getElementById('continueSection'), grid: document.getElementById('continueGrid') },
  favorites: { section: document.getElementById('favoritesSection'), grid: document.getElementById('favoritesGrid') },
  recommended: { section: document.getElementById('recommendedSection'), grid: document.getElementById('recommendedGrid') },
  trending: { section: document.getElementById('trendingSection'), grid: document.getElementById('trendingGrid') },
  popularMovies: { section: document.getElementById('popularMoviesSection'), grid: document.getElementById('popularMoviesGrid') },
  popularTv: { section: document.getElementById('popularTvSection'), grid: document.getElementById('popularTvGrid') },
};

const settingsDialog = document.getElementById('settings');
const apiKeyEl = document.getElementById('apiKey');
const openSettingsEl = document.getElementById('openSettings');

isTmdbServerConfigured().then((configured) => {
  if (configured) openSettingsEl.hidden = true;
});

openSettingsEl.addEventListener('click', () => {
  apiKeyEl.value = getApiKey();
  settingsDialog.showModal();
});
document.getElementById('cancelSettings').addEventListener('click', () => settingsDialog.close());
document.getElementById('saveSettings').addEventListener('click', () => {
  setApiKey(apiKeyEl.value);
  settingsDialog.close();
  init();
});

function goToPlayer(item, extra) {
  const params = new URLSearchParams({ type: item.type, id: item.id, ...(extra || {}) });
  window.location.href = `player.html?${params}`;
}

function showEpisodePicker(item) {
  openSeasonEpisodePicker(item.id, item.title, (season, episode) => {
    goToPlayer(item, { season, episode });
  });
}

function mapContinueWatchingRow(row) {
  return {
    id: row.tmdb_id,
    type: row.media_type,
    title: row.title,
    poster: posterUrl(row.poster_path),
    progress: row.progress,
    duration: row.duration,
    season: row.season,
    episode: row.episode,
  };
}

function mapFavoriteRow(row) {
  return { id: row.tmdb_id, type: row.media_type, title: row.title, poster: posterUrl(row.poster_path) };
}

function continueWatchingSubtitle(item) {
  return item.type === 'tv' && item.season && item.episode ? `S${item.season} E${item.episode}` : '';
}

// Continue Watching / Favorites rows come from our own DB, which only stores
// title/poster — not the year or overview the hover-preview overlay shows
// for every other row. Fill those in from TMDB so the overlay isn't just a
// bare title for these two rows.
async function enrichWithDetails(items) {
  return Promise.all(
    items.map((item) =>
      fetchDetails(item.type, item.id)
        .then((data) => ({
          ...item,
          year: (data.release_date || data.first_air_date || '').slice(0, 4),
          overview: data.overview || '',
        }))
        .catch(() => item)
    )
  );
}

async function loadContinueWatching() {
  try {
    const items = await enrichWithDetails((await getContinueWatching()).map(mapContinueWatchingRow));
    renderMediaRow(rows.continue.section, rows.continue.grid, items, {
      onSelect: goToPlayer,
      onRemove: async (item) => {
        await removeContinueWatching(item.type, item.id);
        loadContinueWatching();
      },
      onShowEpisodes: showEpisodePicker,
      subtitleFor: continueWatchingSubtitle,
    });
    return items;
  } catch {
    rows.continue.section.hidden = true;
    return [];
  }
}

async function loadFavorites() {
  try {
    const items = await enrichWithDetails((await getFavorites()).map(mapFavoriteRow));
    renderMediaRow(rows.favorites.section, rows.favorites.grid, items, {
      onSelect: goToPlayer,
      onRemove: async (item) => {
        await removeFavorite(item.type, item.id);
        loadFavorites();
      },
      onShowEpisodes: showEpisodePicker,
    });
    return items;
  } catch {
    rows.favorites.section.hidden = true;
    return [];
  }
}

// "Recommended For You": seed TMDB's /recommendations off whatever the user
// is actually watching or has favorited, merge, and dedupe against itself
// and the seeds.
async function loadRecommended(seeds) {
  const seedList = seeds.slice(0, 5);
  if (seedList.length === 0) {
    rows.recommended.section.hidden = true;
    return;
  }
  const seen = new Set(seedList.map((item) => `${item.type}-${item.id}`));
  try {
    const lists = await Promise.all(seedList.map((item) => fetchRecommendations(item.type, item.id).catch(() => [])));
    const merged = [];
    for (const list of lists) {
      for (const item of list) {
        const key = `${item.type}-${item.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
      }
    }
    merged.sort((a, b) => b.popularity - a.popularity);
    renderMediaRow(rows.recommended.section, rows.recommended.grid, merged.slice(0, 20), {
      onSelect: goToPlayer,
      onShowEpisodes: showEpisodePicker,
    });
  } catch {
    rows.recommended.section.hidden = true;
  }
}

async function loadDiscoveryRows() {
  const [trending, popularMovies, popularTv] = await Promise.all([
    fetchTrending().catch(() => []),
    fetchPopular('movie').catch(() => []),
    fetchPopular('tv').catch(() => []),
  ]);

  renderMediaRow(rows.trending.section, rows.trending.grid, trending, { onSelect: goToPlayer, onShowEpisodes: showEpisodePicker });
  renderMediaRow(rows.popularMovies.section, rows.popularMovies.grid, popularMovies, { onSelect: goToPlayer });
  renderMediaRow(rows.popularTv.section, rows.popularTv.grid, popularTv, { onSelect: goToPlayer, onShowEpisodes: showEpisodePicker });

  renderHero(heroEl, trending[0] || popularMovies[0] || null, goToPlayer);
}

async function init() {
  const [continueItems, favoriteItems] = await Promise.all([loadContinueWatching(), loadFavorites()]);
  loadRecommended([...continueItems, ...favoriteItems]);
  loadDiscoveryRows();
}

init();
