import { searchMulti } from './tmdb.js';
import { escapeHtml } from './ui.js';

const queryEl = document.getElementById('query');
const clearBtnEl = document.getElementById('clearQuery');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');

let debounceTimer;
queryEl.addEventListener('input', () => {
  clearBtnEl.hidden = queryEl.value.length === 0;
  clearTimeout(debounceTimer);
  const q = queryEl.value.trim();
  if (q.length < 2) {
    resultsEl.innerHTML = '';
    statusEl.textContent = '';
    return;
  }
  statusEl.textContent = 'Searching...';
  debounceTimer = setTimeout(() => runSearch(q), 400);
});

clearBtnEl.addEventListener('click', () => {
  queryEl.value = '';
  clearBtnEl.hidden = true;
  resultsEl.innerHTML = '';
  statusEl.textContent = '';
  queryEl.focus();
});

async function runSearch(q) {
  try {
    const results = await searchMulti(q);
    statusEl.textContent = results.length ? `${results.length} results` : 'No results';
    render(results);
  } catch (err) {
    statusEl.textContent = err.message;
  }
}

function render(results) {
  resultsEl.innerHTML = '';
  for (const item of results) {
    const isPerson = item.type === 'person';
    const card = document.createElement('div');
    card.className = 'card' + (isPerson ? ' card-person' : '');
    card.innerHTML = `
      <img src="${item.poster || ''}" alt="${escapeHtml(item.title)}" loading="lazy" />
      <div class="meta">
        <p class="title">${escapeHtml(item.title)}</p>
        <p class="sub">${isPerson ? 'Actor' : `${item.year || ''} &middot; ${item.type}`}</p>
      </div>
    `;
    card.addEventListener('click', () => {
      if (isPerson) {
        window.location.href = `person.html?id=${item.id}&name=${encodeURIComponent(item.title)}`;
      } else {
        window.location.href = `player.html?type=${item.type}&id=${item.id}`;
      }
    });
    resultsEl.appendChild(card);
  }
}
