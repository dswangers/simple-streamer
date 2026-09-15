/* Shared rendering used across index/search/person/player pages: media-card
   rows (poster + progress bar + remove/episodes badges + hover-to-preview,
   the mouse equivalent of the mobile app's long-press preview) and the
   home-page hero banner. */

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// options: { onSelect(item), onRemove(item)?, onShowEpisodes(item)?, subtitleFor(item)? }
export function renderMediaRow(sectionEl, gridEl, items, options) {
  const { onSelect, onRemove, onShowEpisodes, subtitleFor } = options;
  gridEl.innerHTML = '';
  if (sectionEl) sectionEl.hidden = !items || items.length === 0;
  if (!items) return;

  for (const item of items) {
    const progressPct = item.duration ? Math.min(100, (item.progress / item.duration) * 100) : 0;
    const subtitle = subtitleFor ? subtitleFor(item) : '';
    const showEpisodesBtn = Boolean(onShowEpisodes && item.type === 'tv');

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img src="${item.poster || ''}" alt="${escapeHtml(item.title)}" loading="lazy" />
      ${progressPct > 0 ? `<div class="progress-track"><div class="progress-fill" style="width:${progressPct}%"></div></div>` : ''}
      ${onRemove ? '<button class="remove-btn" type="button" aria-label="Remove">&times;</button>' : ''}
      ${showEpisodesBtn ? '<button class="episodes-btn" type="button" aria-label="Episodes">&#9776;</button>' : ''}
      <div class="card-info-overlay">
        <p class="info-title">${escapeHtml(item.title)}</p>
        ${item.year ? `<p class="info-meta">${escapeHtml(item.year)} &middot; ${item.type === 'tv' ? 'TV' : 'Movie'}</p>` : ''}
        ${item.overview ? `<p class="info-overview">${escapeHtml(item.overview)}</p>` : ''}
      </div>
      <div class="meta">
        <p class="title">${escapeHtml(item.title)}</p>
        ${subtitle ? `<p class="sub">${escapeHtml(subtitle)}</p>` : ''}
      </div>
    `;

    card.addEventListener('click', () => onSelect(item));

    if (onRemove) {
      card.querySelector('.remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        onRemove(item);
      });
    }
    if (showEpisodesBtn) {
      card.querySelector('.episodes-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        onShowEpisodes(item);
      });
    }

    gridEl.appendChild(card);
  }
}

export function renderHero(container, item, onPlay) {
  if (!item) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }
  container.hidden = false;
  container.innerHTML = `
    <img class="hero-bg" src="${item.backdrop || item.poster || ''}" alt="" />
    <div class="hero-gradient"></div>
    <div class="hero-content">
      <h1 class="hero-title">${escapeHtml(item.title)}</h1>
      ${item.overview ? `<p class="hero-overview">${escapeHtml(item.overview)}</p>` : ''}
      <button class="hero-play-btn" type="button">&#9654; Play</button>
    </div>
  `;
  container.querySelector('.hero-play-btn').addEventListener('click', () => onPlay(item));
}
