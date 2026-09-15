import { fetchDetails, fetchSeason, fetchSimilar, posterUrl, profileUrl } from './tmdb.js';
import { fetchRatings } from './omdb.js';
import {
  getContinueWatchingItem,
  saveProgress,
  removeContinueWatching,
  getFavorite,
  addFavorite,
  removeFavorite,
} from './api.js';
import { renderMediaRow, escapeHtml } from './ui.js';

const EMBED_BASE = 'https://vidsrcme.ru';

const statusEl = document.getElementById('status');
const titleRow = document.getElementById('titleRow');
const posterEl = document.getElementById('poster');
const titleNameEl = document.getElementById('titleName');
const metaEl = document.getElementById('meta');
const ratingsRowEl = document.getElementById('ratingsRow');
const overviewEl = document.getElementById('overview');
const dataScriptEl = document.getElementById('tmdb-data');
const favoriteBtnEl = document.getElementById('favoriteBtn');
const frameEl = document.getElementById('player-frame');
const emptyNoteEl = document.getElementById('emptyNote');

const seasonChipsSectionEl = document.getElementById('seasonChipsSection');
const seasonRowEl = document.getElementById('seasonRow');
const episodeListSectionEl = document.getElementById('episodeListSection');
const episodeListEl = document.getElementById('episodeList');
const castSectionEl = document.getElementById('castSection');
const castListEl = document.getElementById('castList');
const similarSectionEl = document.getElementById('similarSection');
const similarGridEl = document.getElementById('similarGrid');

const params = new URLSearchParams(window.location.search);
const type = params.get('type') === 'tv' ? 'tv' : 'movie';
const id = params.get('id');
const paramSeason = params.get('season') ? Number(params.get('season')) : null;
const paramEpisode = params.get('episode') ? Number(params.get('episode')) : null;

let tmdbData = null;
let resume = null;
let isFavorite = false;
let seasons = [];
let selectedSeason = null;
let selectedEpisode = null;

if (!id) {
  statusEl.textContent = 'No title selected.';
} else {
  load();
}

function isResumable(r) {
  if (!r) return false;
  const nearlyDone = r.duration > 0 && r.progress / r.duration > 0.95;
  return r.progress > 10 && !nearlyDone;
}

function formatRuntime(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function rottenTomatoesColor(value) {
  const pct = parseInt(value, 10);
  return pct >= 60 ? '#3ecf5b' : '#e5484d';
}

function metascoreColor(value) {
  const score = parseInt(value, 10);
  if (score >= 61) return '#3ecf5b';
  if (score >= 40) return '#f5c518';
  return '#e5484d';
}

async function load() {
  statusEl.textContent = 'Loading...';
  try {
    const [data, resumeItem, favorite, similarItems] = await Promise.all([
      fetchDetails(type, id),
      getContinueWatchingItem(type, id).catch(() => null),
      getFavorite(type, id).catch(() => null),
      fetchSimilar(type, id).catch(() => []),
    ]);

    tmdbData = data;
    window.TMDB_DATA = { type, ...data };
    dataScriptEl.textContent = JSON.stringify(window.TMDB_DATA, null, 2);
    resume = resumeItem;
    isFavorite = Boolean(favorite);
    statusEl.textContent = '';

    render(data);
    renderFavoriteButton();
    renderCast(data);
    renderMediaRow(similarSectionEl, similarGridEl, similarItems, {
      onSelect: (item) => {
        window.location.href = `player.html?type=${item.type}&id=${item.id}`;
      },
    });

    fetchRatings(data.external_ids?.imdb_id).then(renderRatings);

    if (type === 'tv') {
      seasons = (data.seasons || []).filter((s) => s.episode_count > 0);
      selectedSeason = paramSeason || resumeItem?.season || seasons[0]?.season_number || 1;
      selectedEpisode = paramEpisode || (resumeItem?.season === selectedSeason ? resumeItem.episode : 1);
      renderSeasonChips();
      loadEpisodes(selectedSeason);
    }

    updateEmbedSrc();
    emptyNoteEl.style.display = 'none';
  } catch (err) {
    statusEl.textContent = err.message;
  }
}

function updateEmbedSrc() {
  if (type === 'movie') {
    const base = `${EMBED_BASE}/embed/movie/${id}`;
    const startAt = isResumable(resume) ? Math.floor(resume.progress) : null;
    frameEl.src = startAt ? `${base}?startAt=${startAt}` : base;
    return;
  }
  if (!selectedSeason || !selectedEpisode) return;
  const base = `${EMBED_BASE}/embed/tv/${id}/${selectedSeason}/${selectedEpisode}`;
  const matchesResume = resume && resume.season === selectedSeason && resume.episode === selectedEpisode;
  const startAt = matchesResume && isResumable(resume) ? Math.floor(resume.progress) : null;
  frameEl.src = startAt ? `${base}?startAt=${startAt}` : base;
}

function render(data) {
  const title = data.title || data.name || 'Untitled';
  titleNameEl.textContent = title;
  overviewEl.textContent = data.overview || '';
  if (data.poster_path) posterEl.src = posterUrl(data.poster_path);
  document.title = title;

  const year = (data.release_date || data.first_air_date || '').slice(0, 4);
  const runtimeLabel = formatRuntime(type === 'movie' ? data.runtime : data.episode_run_time?.[0]);
  const genreLabel = (data.genres || []).map((g) => g.name).join(' · ');
  metaEl.textContent = [year, runtimeLabel, genreLabel].filter(Boolean).join('  ·  ');

  titleRow.style.display = 'flex';
}

function renderRatings(ratings) {
  if (!ratings || (!ratings.imdb && !ratings.rottenTomatoes && !ratings.metascore)) {
    ratingsRowEl.hidden = true;
    return;
  }
  ratingsRowEl.hidden = false;
  ratingsRowEl.innerHTML = [
    ratings.imdb
      ? `<span class="rating-badge"><span class="rating-label">IMDb</span><span class="rating-value">${escapeHtml(
          ratings.imdb
        )}</span></span>`
      : '',
    ratings.rottenTomatoes
      ? `<span class="rating-badge"><span class="rating-label">RT</span><span class="rating-value" style="color:${rottenTomatoesColor(
          ratings.rottenTomatoes
        )}">${escapeHtml(ratings.rottenTomatoes)}</span></span>`
      : '',
    ratings.metascore
      ? `<span class="rating-badge"><span class="rating-label">Metascore</span><span class="rating-value" style="color:${metascoreColor(
          ratings.metascore
        )}">${escapeHtml(ratings.metascore)}</span></span>`
      : '',
  ].join('');
}

function renderFavoriteButton() {
  favoriteBtnEl.textContent = isFavorite ? '★ Favorited' : '☆ Add to Favorites';
  favoriteBtnEl.classList.toggle('active', isFavorite);
}

favoriteBtnEl.addEventListener('click', async () => {
  if (!tmdbData) return;
  favoriteBtnEl.disabled = true;
  try {
    if (isFavorite) {
      await removeFavorite(type, id);
    } else {
      await addFavorite({
        mediaType: type,
        tmdbId: id,
        imdbId: tmdbData.external_ids?.imdb_id || null,
        title: tmdbData.title || tmdbData.name || 'Untitled',
        posterPath: tmdbData.poster_path || null,
      });
    }
    isFavorite = !isFavorite;
    renderFavoriteButton();
  } catch (err) {
    statusEl.textContent = err.message;
  } finally {
    favoriteBtnEl.disabled = false;
  }
});

function renderSeasonChips() {
  seasonChipsSectionEl.hidden = false;
  seasonRowEl.innerHTML = seasons
    .map(
      (s) =>
        `<button class="season-chip${s.season_number === selectedSeason ? ' active' : ''}" type="button" data-season="${s.season_number}">${
          s.season_number === 0 ? 'Specials' : `Season ${s.season_number}`
        }</button>`
    )
    .join('');
  seasonRowEl.querySelectorAll('.season-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const seasonNumber = Number(chip.dataset.season);
      selectedSeason = seasonNumber;
      selectedEpisode = resume?.season === seasonNumber ? resume.episode : 1;
      seasonRowEl.querySelectorAll('.season-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      loadEpisodes(seasonNumber);
      updateEmbedSrc();
    });
  });
}

async function loadEpisodes(seasonNumber) {
  episodeListSectionEl.hidden = false;
  episodeListEl.innerHTML = '<p class="loading-text">Loading episodes...</p>';
  try {
    const data = await fetchSeason(id, seasonNumber);
    const episodes = data.episodes || [];
    episodeListEl.innerHTML = episodes
      .map(
        (ep) => `
      <div class="episode-row${ep.episode_number === selectedEpisode ? ' active' : ''}" data-episode="${ep.episode_number}">
        <img src="${ep.still_path ? posterUrl(ep.still_path) : ''}" alt="" />
        <div class="episode-info">
          <p class="episode-title">${ep.episode_number}. ${escapeHtml(ep.name)}</p>
          ${ep.overview ? `<p class="episode-overview">${escapeHtml(ep.overview)}</p>` : ''}
        </div>
      </div>`
      )
      .join('');
    episodeListEl.querySelectorAll('.episode-row').forEach((row) => {
      row.addEventListener('click', () => {
        selectedEpisode = Number(row.dataset.episode);
        episodeListEl.querySelectorAll('.episode-row').forEach((r) => r.classList.remove('active'));
        row.classList.add('active');
        updateEmbedSrc();
      });
    });
  } catch (err) {
    episodeListEl.innerHTML = `<p class="loading-text">${escapeHtml(err.message)}</p>`;
  }
}

function renderCast(data) {
  const cast = data.credits?.cast?.slice(0, 12) || [];
  if (cast.length === 0) {
    castSectionEl.hidden = true;
    return;
  }
  castSectionEl.hidden = false;
  castListEl.innerHTML = cast
    .map(
      (person) => `
    <div class="cast-card" data-id="${person.id}" data-name="${escapeHtml(person.name)}">
      ${
        person.profile_path
          ? `<img src="${profileUrl(person.profile_path)}" alt="" class="cast-photo" />`
          : `<div class="cast-photo cast-photo-fallback">${escapeHtml((person.name || '?')[0])}</div>`
      }
      <p class="cast-name">${escapeHtml(person.name)}</p>
      <p class="cast-character">${escapeHtml(person.character || '')}</p>
    </div>`
    )
    .join('');
  castListEl.querySelectorAll('.cast-card').forEach((card) => {
    card.addEventListener('click', () => {
      window.location.href = `person.html?id=${card.dataset.id}&name=${encodeURIComponent(card.dataset.name)}`;
    });
  });
}

// Player events (see the embed API docs): posted by our iframe as playback
// progresses, so we can persist exact resume positions ourselves instead of
// relying on the embed's own "last episode" resume.
window.addEventListener('message', (event) => {
  if (event.source !== frameEl.contentWindow) return;
  const payload = event.data;
  if (!payload || payload.type !== 'PLAYER_EVENT') return;

  const { player_info, player_status, player_progress, player_duration } = payload.data || {};
  if (!tmdbData) return;

  if (player_status === 'completed') {
    removeContinueWatching(type, id).catch(() => {});
    return;
  }

  if ((player_status === 'playing' || player_status === 'paused' || player_status === 'seeked') && player_duration) {
    saveProgress({
      mediaType: type,
      tmdbId: id,
      imdbId: player_info?.imdb || tmdbData.external_ids?.imdb_id || null,
      title: tmdbData.title || tmdbData.name || 'Untitled',
      posterPath: tmdbData.poster_path || null,
      season: player_info?.season ?? selectedSeason ?? null,
      episode: player_info?.episode ?? selectedEpisode ?? null,
      progress: player_progress,
      duration: player_duration,
    }).catch(() => {});
  }
});
