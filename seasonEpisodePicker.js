/* The "☰" badge on a TV card (see ui.js) opens this instead of navigating
   straight into the player, so you can jump to a specific episode without
   leaving the browse screen — mirrors the mobile app's bottom-sheet picker. */

import { fetchDetails, fetchSeason, posterUrl } from './tmdb.js';
import { escapeHtml } from './ui.js';

let dialogEl, titleEl, seasonRowEl, episodeListEl;
let onSelectCallback = null;

function ensureDialog() {
  if (dialogEl) return;
  dialogEl = document.createElement('dialog');
  dialogEl.id = 'seasonEpisodeDialog';
  dialogEl.innerHTML = `
    <div class="sep-header">
      <h3 class="sep-title"></h3>
      <button class="sep-close" type="button" aria-label="Close">&times;</button>
    </div>
    <div class="sep-seasons"></div>
    <div class="sep-episodes"></div>
  `;
  document.body.appendChild(dialogEl);
  titleEl = dialogEl.querySelector('.sep-title');
  seasonRowEl = dialogEl.querySelector('.sep-seasons');
  episodeListEl = dialogEl.querySelector('.sep-episodes');
  dialogEl.querySelector('.sep-close').addEventListener('click', () => dialogEl.close());
  dialogEl.addEventListener('click', (e) => {
    if (e.target === dialogEl) dialogEl.close();
  });
}

async function loadEpisodes(tvId, seasonNumber) {
  episodeListEl.innerHTML = '<p class="loading-text">Loading...</p>';
  try {
    const data = await fetchSeason(tvId, seasonNumber);
    const episodes = data.episodes || [];
    episodeListEl.innerHTML = episodes
      .map(
        (ep) => `
      <div class="episode-row" data-episode="${ep.episode_number}">
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
        const episode = Number(row.dataset.episode);
        dialogEl.close();
        if (onSelectCallback) onSelectCallback(seasonNumber, episode);
      });
    });
  } catch (err) {
    episodeListEl.innerHTML = `<p class="loading-text">${escapeHtml(err.message)}</p>`;
  }
}

export async function openSeasonEpisodePicker(tvId, title, onSelect) {
  ensureDialog();
  onSelectCallback = onSelect;
  titleEl.textContent = title || '';
  seasonRowEl.innerHTML = '<p class="loading-text">Loading...</p>';
  episodeListEl.innerHTML = '';
  dialogEl.showModal();

  try {
    const data = await fetchDetails('tv', tvId);
    const seasons = (data.seasons || []).filter((s) => s.episode_count > 0);
    seasonRowEl.innerHTML = seasons
      .map(
        (s, i) =>
          `<button class="season-chip${i === 0 ? ' active' : ''}" type="button" data-season="${s.season_number}">${
            s.season_number === 0 ? 'Specials' : `Season ${s.season_number}`
          }</button>`
      )
      .join('');
    seasonRowEl.querySelectorAll('.season-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        seasonRowEl.querySelectorAll('.season-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        loadEpisodes(tvId, Number(chip.dataset.season));
      });
    });
    if (seasons.length > 0) {
      loadEpisodes(tvId, seasons[0].season_number);
    } else {
      episodeListEl.innerHTML = '<p class="loading-text">No seasons found.</p>';
    }
  } catch (err) {
    seasonRowEl.innerHTML = `<p class="loading-text">${escapeHtml(err.message)}</p>`;
  }
}
