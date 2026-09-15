import { fetchPerson, fetchPersonCredits, profileUrl } from './tmdb.js';
import { escapeHtml } from './ui.js';

const params = new URLSearchParams(window.location.search);
const personId = params.get('id');
const name = params.get('name') || '';

const photoEl = document.getElementById('personPhoto');
const nameEl = document.getElementById('personName');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');

nameEl.textContent = name;
document.title = name || 'Actor';

if (!personId) {
  statusEl.textContent = 'No actor selected.';
} else {
  load();
}

async function load() {
  statusEl.textContent = 'Loading...';
  try {
    const [person, credits] = await Promise.all([fetchPerson(personId), fetchPersonCredits(personId)]);
    nameEl.textContent = person.name || name;
    document.title = person.name || name || 'Actor';
    if (person.profile_path) {
      photoEl.src = profileUrl(person.profile_path);
      photoEl.style.display = '';
    }
    statusEl.textContent = credits.length ? '' : 'No credits found.';
    render(credits);
  } catch (err) {
    statusEl.textContent = err.message;
  }
}

function render(credits) {
  resultsEl.innerHTML = '';
  for (const item of credits) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img src="${item.poster || ''}" alt="${escapeHtml(item.title)}" loading="lazy" />
      <div class="meta">
        <p class="title">${escapeHtml(item.title)}</p>
        <p class="sub">${item.year || ''} &middot; ${item.type}</p>
      </div>
    `;
    card.addEventListener('click', () => {
      window.location.href = `player.html?type=${item.type}&id=${item.id}`;
    });
    resultsEl.appendChild(card);
  }
}
