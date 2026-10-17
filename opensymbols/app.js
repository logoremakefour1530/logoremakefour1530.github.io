// Simple OpenSymbols image search front-end
const API_BASE = 'https://d18vdu4p71yql0.cloudfront.net'; // <-- your service worker image API base
const searchForm = document.getElementById('searchForm');
const qInput = document.getElementById('q');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');
const unsafeModeCheckbox = document.getElementById('unsafe-mode');

// Register service worker (if available)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').then(reg => {
    console.log('SW registered', reg);
  }).catch(err => console.warn('SW register failed', err));
}

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = qInput.value.trim();
  if (!q) return;
  resultsEl.innerHTML = '';
  setStatus('Searching...');
  try {
    // Example API path: /search/images?q=...
    // If your API uses a different path change the URL below.
    const url = `${API_BASE}/search/images?q=${encodeURIComponent(q)}`;
    const resp = await fetch(url, {mode: 'cors'});
    if (!resp.ok) throw new Error(`API responded ${resp.status}`);
    const data = await resp.json();
    // Expecting data.images = [{url,title,id}] or data = [{...}]
    const images = Array.isArray(data) ? data : (data.images || []);
    if (!images.length) {
      setStatus('No results.');
      return;
    }
    setStatus(`${images.length} results`);
    images.forEach(addImageCard);
  } catch (err) {
    console.error(err);
    setStatus('Search failed — check console and CORS policy. ' + (err.message || ''));
    // Fallback: show a link to try direct search on base (useful for debugging)
    resultsEl.innerHTML = `<div class="card"><div class="title">Error contacting API. You may need to enable CORS on ${API_BASE} or adjust the path.</div></div>`;
  }
});

function setStatus(text) {
  statusEl.textContent = text;
}

function addImageCard(img) {
  // img may be { url, title, id }
  const url = img.url || img.src || img.image;
  const title = img.title || img.name || url;
  const id = img.id || (url && url.split('/').pop());
  const card = document.createElement('div');
  card.className = 'card';

  const imageEl = document.createElement('img');
  imageEl.src = url;
  imageEl.alt = title;
  imageEl.loading = 'lazy';
  card.appendChild(imageEl);

  const meta = document.createElement('div');
  meta.className = 'meta';

  const t = document.createElement('div');
  t.className = 'title';
  t.textContent = title;
  meta.appendChild(t);

  const btns = document.createElement('div');
  btns.style.display = 'flex';
  btns.style.gap = '8px';

  // Download button (attempts to fetch blob then download)
  const dl = document.createElement('button');
  dl.textContent = 'Download';
  dl.addEventListener('click', () => downloadImage(url, `${sanitizeFileName(title || id)}.png`));
  btns.appendChild(dl);

  // Open in new tab
  const open = document.createElement('button');
  open.textContent = 'Open';
  open.addEventListener('click', () => window.open(url, '_blank', 'noopener'));
  btns.appendChild(open);

  meta.appendChild(btns);
  card.appendChild(meta);
  resultsEl.appendChild(card);
}

async function downloadImage(url, filename) {
  setStatus('Downloading...');
  try {
    // Prefer fetching as blob (requires CORS on the image host).
    const resp = await fetch(url, {mode: 'cors'});
    if (!resp.ok) throw new Error('Download failed: ' + resp.status);
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    triggerDownload(blobUrl, filename);
    // cleanup after short delay
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    setStatus('Download started.');
  } catch (err) {
    console.warn('Fetch download failed, trying direct link fallback', err);
    if (unsafeModeCheckbox.checked) {
      // Fallback: open a direct link in a new tab (user can right click and save)
      window.open(url, '_blank', 'noopener');
      setStatus('Opened image in new tab (fallback). If it fails, enable CORS on the image host.');
    } else {
      setStatus('Direct fetch failed. Enable "Allow cross-origin download fallback" to open the image in a new tab instead.');
    }
  }
}

function triggerDownload(href, filename) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename || '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function sanitizeFileName(name){
  return name.replace(/[^a-z0-9_\-\.]/gi, '_').slice(0,200);
}
